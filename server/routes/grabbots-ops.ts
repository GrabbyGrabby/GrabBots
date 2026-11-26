import { randomUUID } from "node:crypto";

import type { ApprovalMode } from "../../shared/approval-mode.ts";
import type { Coordinator } from "../coordinator.ts";
import type { DesktopComputer } from "../desktop-computer.ts";
import { collectGrabBotsArchitecture } from "../grabbots-architecture.ts";
import type { BotRecord, Store } from "../store.ts";
import { createGrabBotsWorkspaceRoutes } from "./grabbots-workspace.ts";
import { PASS, type RouteHandler } from "./table.ts";

export interface GrabBotsOpsDeps {
  store: Pick<Store, "bots" | "groups" | "bot" | "group" | "appendMessage">;
  coordinator: Pick<Coordinator, "active" | "liveEdges" | "beginTurn" | "enqueue" | "endTurn">;
  desktopComputer: Pick<DesktopComputer, "granted" | "unavailableReason">;
  instances: () => Array<{ instanceId: string; driverKind: string }>;
  snapshot: (instanceId: string) => unknown;
  boxOn: () => boolean;
  boxProbe?: () => ReturnType<typeof import("../bot-box/detect.ts").detectBox>;
  probeVm?: () => Promise<import("../container-computer.ts").ContainerComputerStatus>;
  onDispatch?: (summary: { groupId?: string; generation: string }) => void;
  dataDir?: string;
  repoRoot?: string;
}

export function createGrabBotsOpsRoutes(deps: GrabBotsOpsDeps): RouteHandler {
  const { store, coordinator } = deps;
  const workspaceRoutes = createGrabBotsWorkspaceRoutes({
    store,
    ...(deps.dataDir ? { dataDir: deps.dataDir } : {}),
    ...(deps.repoRoot ? { repoRoot: deps.repoRoot } : {}),
  });
  return async (ctx) => {
    const workspaceResult = await workspaceRoutes(ctx);
    if (workspaceResult !== PASS || ctx.res.headersSent || ctx.res.writableEnded) return;
    const { req, res, path, method, json, readBody } = ctx;
    if (method === "GET" && path === "/api/grabbots/architecture") {
      res.setHeader("cache-control", "no-store");
      const snapshot = await collectGrabBotsArchitecture({
        store,
        coordinator,
        desktopComputer: deps.desktopComputer,
        instances: deps.instances,
        snapshot: deps.snapshot,
        ...(deps.boxProbe ? { boxProbe: deps.boxProbe } : {}),
        ...(deps.probeVm ? { probeVm: deps.probeVm } : {}),
      });
      return json(res, 200, {
        ...snapshot,
        boxEnabled: deps.boxOn(),
      });
    }

    if (method === "POST" && path === "/api/grabbots/dag/dispatch") {
      const body = await readBody(req, 16_384);
      const objective = typeof body?.objective === "string" ? body.objective.trim() : "";
      if (!objective) return json(res, 400, { error: "objective is required" });
      if (objective.length > 4000) return json(res, 400, { error: "objective must be at most 4000 characters" });

      const liveBots: BotRecord[] = store.bots.filter((b: BotRecord) => !b.hidden);
      const rootId = typeof body?.rootBotId === "string" ? body.rootBotId.trim() : "";
      const root: BotRecord | undefined = (rootId ? store.bot(rootId) : undefined)
        ?? liveBots.find((b: BotRecord) => b.chiefOfStaff)
        ?? liveBots.find((b: BotRecord) => b.name.toLowerCase() === "zeus")
        ?? liveBots[0];
      if (!root) return json(res, 404, { error: "no active coordinator bot found" });

      const requestedTargets = Array.isArray(body?.targetBotIds)
        ? body.targetBotIds.filter((id: unknown): id is string => typeof id === "string" && id !== root.id)
        : [];
      const targets: BotRecord[] = requestedTargets.length > 0
        ? requestedTargets
            .map((id: string) => store.bot(id))
            .filter((b: BotRecord | undefined): b is BotRecord => Boolean(b && !b.hidden))
        : liveBots.filter((b: BotRecord) => b.id !== root.id).slice(0, 3);

      const groupId = typeof body?.groupId === "string" && body.groupId.trim() ? body.groupId.trim() : undefined;
      const group = groupId ? store.group(groupId) : store.groups.find((g) => !g.dm);

      const generation = randomUUID();
      const fanOut = targets.length > 1 ? randomUUID() : undefined;
      const requestBatchKey = group ? randomUUID() : undefined;
      const level: ApprovalMode = (root.approvalMode as ApprovalMode | undefined) ?? "auto";

      coordinator.beginTurn({
        id: generation,
        address: { botId: root.id, threadId: root.threadId },
        brief: objective,
        level,
      });

      const edges: Array<{ nodeId: string; targetBotId: string; targetName: string; duplicate: boolean }> = [];
      for (const target of targets) {
        const subBrief = `[GrabBots ACP DAG · From ${root.name} → ${target.name}] ${objective}`;
        const { node, duplicate } = coordinator.enqueue(
          { botId: root.id, threadId: root.threadId },
          generation,
          undefined,
          { botId: target.id, threadId: target.threadId, ...(group ? { groupId: group.id } : {}) },
          subBrief,
          {
            mode: "work",
            reply: "poll",
            thread: "standing",
            ...(fanOut ? { fanOut } : {}),
            ...(requestBatchKey ? { requestBatchKey } : {}),
          },
        );
        edges.push({
          nodeId: node.id,
          targetBotId: target.id,
          targetName: target.name,
          duplicate,
        });
      }

      if (targets.length === 0) {
        coordinator.endTurn(generation, { ok: true, text: `Root objective logged on ${root.name}` });
      }

      store.appendMessage(group ? group.threadId : root.threadId, {
        role: "bot",
        kind: "text",
        from: {
          botId: root.id,
          name: root.name,
          color: root.color,
        },
        text: targets.length > 0
          ? `ACP DAG dispatched (${generation.slice(0, 8)}): "${objective}" → ${targets.map((target: BotRecord) => target.name).join(", ")}.`
          : `Objective queued on ${root.name}: "${objective}".`,
      });

      deps.onDispatch?.({ groupId: group?.id, generation });

      return json(res, 202, {
        ok: true,
        generation,
        rootBot: { id: root.id, name: root.name },
        groupId: group?.id ?? null,
        dispatched: edges,
      });
    }

    return PASS;
  };
}
