import { IncomingMessage, ServerResponse } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createCoordinator, type CoordinatorHost } from "./coordinator.ts";
import type { ModelSelection } from "./contracts.ts";
import { createDesktopComputer } from "./desktop-computer.ts";
import { ensureGrabBotsSquad } from "./grabbots-seed.ts";
import { createGrabBotsOpsRoutes } from "./routes/grabbots-ops.ts";
import { Store } from "./store.ts";

const tempDirs: string[] = [];
const selection = (): ModelSelection => ({ instanceId: "claude", model: "claude-sonnet-5" });

function freshDataDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "grabbots-arch-test-"));
  tempDirs.push(dir);
  return dir;
}

const noopHost: CoordinatorHost = {
  validate: () => undefined,
  busy: () => false,
  run: async () => ({ ok: true, text: "done" }),
  report: () => {},
  changed: () => {},
  names: () => ({ requester: "Zeus", assignee: "Kraken" }),
  park: () => {},
  levelOf: () => ({ level: "auto" }),
  chiefOf: () => true,
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("GrabBots Architecture & ACP DAG routes", () => {
  it("reports OS, Sandbox, VM and Squad telemetry and dispatches ACP DAG edges across Kraken, Knull & Xerxes", async () => {
    const dir = freshDataDir();
    const store = new Store(selection);
    ensureGrabBotsSquad(store, { dataDir: dir });
    const coordinator = createCoordinator({ dataDir: ":memory:", host: noopHost });
    const desktopComputer = createDesktopComputer({ platform: "win32" });

    const handler = createGrabBotsOpsRoutes({
      store,
      coordinator,
      desktopComputer,
      instances: () => [{ instanceId: "claude", driverKind: "claudeAgent" }],
      snapshot: () => ({ state: "available" }),
      boxOn: () => false,
      boxProbe: () => ({ box: "off", reason: "not-cloud", tools: null }),
      probeVm: async () => ({
        platform: "win32",
        runtime: "podman",
        available: ["podman"],
        daemonUp: true,
        image: true,
        imageMatches: true,
        managed: true,
        container: "running",
        network: "loopback",
        security: "hardened",
        persistence: "durable",
        desktopReady: true,
        desktop_error: null,
        resumable: false,
        create_supported: true,
        ready: true,
        problem: null,
        image_ref: "grabbots-cua",
        image_id: "sha256:test",
        base_image_ref: "base",
        driver_version: "1.0.0",
        container_name: "grabbots-vm",
        target_key: "shared",
        workspace_path: dir,
        workspace_guest_path: "/workspace",
        viewer_port: 6080,
        viewer_url: "http://127.0.0.1:6080/vnc.html",
      }),
    });

    const responses: Array<{ status: number; body: unknown }> = [];
    const makeCtx = (method: string, path: string, body?: unknown) => ({
      req: {} as IncomingMessage,
      res: { setHeader: () => {} } as unknown as ServerResponse,
      url: new URL(`http://127.0.0.1${path}`),
      path,
      method,
      auth: { kind: "loopback", trust: "local", scopes: ["admin"] } as never,
      json: (_res: ServerResponse, status: number, payload: unknown) => {
        responses.push({ status, body: payload });
      },
      readBody: async () => body,
    });

    await handler(makeCtx("POST", "/api/grabbots/dag/dispatch", { objective: "Audit OS sandboxing and benchmark UI" }));
    expect(responses[0]?.status).toBe(202);
    const dispatchBody = responses[0]?.body as { rootBot: { name: string }; dispatched: Array<{ targetName: string }> };
    expect(dispatchBody.rootBot.name).toBe("Zeus");
    expect(dispatchBody.dispatched.map((d) => d.targetName).sort()).toEqual(["Knull", "Kraken", "Xerxes"]);

    await handler(makeCtx("GET", "/api/grabbots/architecture"));
    expect(responses[1]?.status).toBe(200);
    const archBody = responses[1]?.body as { product: string; squad: Array<{ name: string }>; acpDag: { activeNodes: number } };
    expect(archBody.product).toBe("GrabBots");
    expect(archBody.squad).toHaveLength(4);
    expect(archBody.acpDag.activeNodes).toBeGreaterThanOrEqual(4);
    coordinator.close();
  });
});
