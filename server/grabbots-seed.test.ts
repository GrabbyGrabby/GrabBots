import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { ModelSelection } from "./contracts.ts";
import { ensureGrabBotsSquad } from "./grabbots-seed.ts";
import { Store } from "./store.ts";

const tempDirs: string[] = [];
const selection = (): ModelSelection => ({ instanceId: "claude", model: "claude-sonnet-5" });

function freshDataDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "grabbots-seed-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("ensureGrabBotsSquad", () => {
  it("seeds Zeus, Kraken, Knull, Xerxes with open-bot-avatar specs and the GrabBots Command Hub room once", () => {
    const dir = freshDataDir();
    const store = new Store(selection);
    const first = ensureGrabBotsSquad(store, { dataDir: dir });

    expect(first.seeded).toBe(true);
    expect(first.bots.map((b) => [b.name, b.mascotBody, b.color, Boolean(b.chiefOfStaff)])).toEqual([
      ["Zeus", "bunny", "blue", true],
      ["Kraken", "egg", "cyan", false],
      ["Knull", "cat", "orange", false],
      ["Xerxes", "controller", "teal", false],
    ]);
    expect(first.commandHub?.name).toBe("GrabBots Command Hub");
    expect(first.commandHub?.memberIds).toHaveLength(4);

    const second = ensureGrabBotsSquad(store, { dataDir: dir });
    expect(second.seeded).toBe(false);
    expect(store.bots).toHaveLength(4);
  });
});
