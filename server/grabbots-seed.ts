import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { writeFileAtomic } from "./atomic.ts";
import type { BotRecord, GroupRecord, Store } from "./store.ts";

const SQUAD_LEDGER = "grabbots-squad.json";

export interface GrabBotSpec {
  id: string;
  name: string;
  title: string;
  description: string;
  soul: string;
  color: BotRecord["color"];
  mascotBody: "bunny" | "egg" | "cat" | "controller";
  chiefOfStaff?: boolean;
  introLine: string;
}

export const GRABBOTS_SQUAD_SPECS: readonly GrabBotSpec[] = [
  {
    id: "zeus",
    name: "Zeus",
    title: "Chief of Staff",
    description: "Coordinates tasks across your bots and routes multi-step work cleanly.",
    soul: "You are Zeus, GrabBots Chief of Staff. Coordinate work across Kraken, Knull, and Xerxes.",
    color: "blue",
    mascotBody: "bunny",
    chiefOfStaff: true,
    introLine: "I am Zeus, your Chief of Staff. Task me with anything or coordinate work with Kraken, Knull, and Xerxes.",
  },
  {
    id: "kraken",
    name: "Kraken",
    title: "Web & Research",
    description: "Extracts web pages, documents, and structured data using the isolated browser.",
    soul: "You are Kraken. Gather primary-source information cleanly and deliver structured findings.",
    color: "cyan",
    mascotBody: "egg",
    introLine: "Kraken ready.",
  },
  {
    id: "knull",
    name: "Knull",
    title: "Systems & Code",
    description: "Builds codebases, runs verified shell commands, and automates computer workflows.",
    soul: "You are Knull. Produce minimal, verified implementations and run clean tests.",
    color: "orange",
    mascotBody: "cat",
    introLine: "Knull ready.",
  },
  {
    id: "xerxes",
    name: "Xerxes",
    title: "Operations & Strategy",
    description: "Executes structured multi-step workflows, audits results, and manages routines.",
    soul: "You are Xerxes. Execute operational workflows thoroughly and verify outcomes.",
    color: "teal",
    mascotBody: "controller",
    introLine: "Xerxes ready.",
  },
];

export type GrabBotsSeedStore = Pick<
  Store,
  "bots" | "groups" | "bot" | "createBot" | "patchBot" | "setChiefOfStaff" | "createGroup" | "appendMessage" | "messagesFor"
>;

export interface GrabBotsSquadResult {
  seeded: boolean;
  bots: BotRecord[];
  commandHub: GroupRecord | null;
}

function ledgerPath(dataDir: string): string {
  return join(dataDir, SQUAD_LEDGER);
}

function readLedger(dataDir: string): { v: number; seededAt: number; botIds: string[]; hubId?: string } | null {
  const file = ledgerPath(dataDir);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as { v: number; seededAt: number; botIds: string[]; hubId?: string };
  } catch {
    return null;
  }
}

/**
 * Seeds the flagship GrabBots squad (Zeus, Kraken, Knull, Xerxes) and Command Hub once per data directory.
 * Never overwrites or recreates bots once the squad ledger has been recorded.
 */
export function ensureGrabBotsSquad(
  store: GrabBotsSeedStore,
  options: { dataDir: string },
): GrabBotsSquadResult {
  const { dataDir } = options;
  const existingLedger = readLedger(dataDir);
  if (existingLedger) {
    const existingHub = existingLedger.hubId ? store.groups.find((g) => g.id === existingLedger.hubId) ?? null : null;
    return { seeded: false, bots: store.bots, commandHub: existingHub };
  }

  const resolved: BotRecord[] = [];
  let chief: BotRecord | undefined;

  for (const spec of GRABBOTS_SQUAD_SPECS) {
    const existing = store.bots.find(
      (candidate) => !candidate.hidden && (candidate.id === spec.id || candidate.name.trim().toLowerCase() === spec.name.toLowerCase()),
    );
    if (existing) {
      resolved.push(existing);
      if (spec.chiefOfStaff) chief = existing;
      continue;
    }

    const created = store.createBot(
      {
        name: spec.name,
        title: spec.title,
        description: spec.description,
        soul: spec.soul,
        color: spec.color,
        mascotBody: spec.mascotBody,
      },
      { id: spec.id, seedMessages: false },
    );
    store.appendMessage(created.threadId, {
      role: "bot",
      kind: "text",
      text: spec.introLine,
      ...(spec.chiefOfStaff ? { helperIntro: true } : {}),
    });
    resolved.push(created);
    if (spec.chiefOfStaff) chief = created;
  }

  if (chief && !chief.chiefOfStaff) {
    store.setChiefOfStaff(chief.id);
  }

  let commandHub = store.groups.find(
    (g) => !g.dm && g.name.trim().toLowerCase() === "grabbots command hub",
  ) ?? null;

  if (!commandHub && resolved.length >= 2) {
    commandHub = store.createGroup(
      "GrabBots Command Hub",
      resolved.map((b) => b.id),
      false,
      undefined,
      {
        id: "grabbots-hub",
        completed: true,
        defaultResponder: chief ? { kind: "member", botId: chief.id } : { kind: "auto" },
        bulletin: "GrabBots Command Hub — Zeus (Chief · Bunny) coordinates tasks across Kraken (Egg), Knull (Cat), and Xerxes (Controller).",
      },
    );
    const hubSpeaker = chief ?? resolved[0]!;
    store.appendMessage(commandHub.threadId, {
      role: "bot",
      kind: "text",
      from: {
        botId: hubSpeaker.id,
        name: hubSpeaker.name,
        color: hubSpeaker.color,
      },
      text: "GrabBots Command Hub ready. Zeus (Bunny) coordinates tasks across Kraken (Egg), Knull (Cat), and Xerxes (Controller).",
    });
  }

  mkdirSync(dataDir, { recursive: true });
  writeFileAtomic(
    ledgerPath(dataDir),
    JSON.stringify({
      v: 1,
      seededAt: Date.now(),
      botIds: resolved.map((b) => b.id),
      ...(commandHub ? { hubId: commandHub.id } : {}),
    }),
    { mode: 0o600 },
  );

  return { seeded: true, bots: resolved, commandHub };
}
