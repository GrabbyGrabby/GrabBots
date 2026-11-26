import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createCoordinator, type CoordinatorHost } from "../coordinator.ts";
import type { ModelSelection } from "../contracts.ts";
import { createDesktopComputer } from "../desktop-computer.ts";
import type { GrabBotsDownloadsPayload } from "../grabbots-downloads.ts";
import { Store } from "../store.ts";
import { createGrabBotsOpsRoutes } from "./grabbots-ops.ts";
import {
  createGrabBotsWorkspaceRoutes,
  type GrabBotsWorkspaceFilesPayload,
} from "./grabbots-workspace.ts";
import type { RouteHandler } from "./table.ts";

const tempDirs: string[] = [];

function freshTempDir(prefix = "grabbots-ws-test-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function invoke(
  handler: RouteHandler,
  method: string,
  pathWithQuery: string,
): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
  const headers: Record<string, string> = {};
  let status = 404;
  let body: unknown = {};
  const url = new URL(`http://127.0.0.1${pathWithQuery}`);
  await handler({
    req: {} as IncomingMessage,
    res: {
      headersSent: false,
      writableEnded: false,
      setHeader: (key: string, value: string) => {
        headers[key.toLowerCase()] = value;
      },
    } as unknown as ServerResponse,
    url,
    path: url.pathname,
    method,
    auth: { kind: "loopback", trust: "local", scopes: ["admin"] } as never,
    json: (_res: ServerResponse, code: number, payload: unknown) => {
      status = code;
      body = payload;
    },
    readBody: async () => undefined,
  });
  return { status, body, headers };
}

afterEach(() => {
  vi.unstubAllEnvs();
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("GET /api/grabbots/downloads", () => {
  it("reports unavailable desktop/android artifacts honestly when release and android build files do not exist", async () => {
    const repoRoot = freshTempDir();
    const dataDir = freshTempDir();
    writeFileSync(join(repoRoot, "package.json"), JSON.stringify({ name: "grabbots", version: "0.2.0" }));
    mkdirSync(join(repoRoot, "public"), { recursive: true });
    writeFileSync(join(repoRoot, "public", "app-icon-192.png"), "png-bytes");
    writeFileSync(
      join(repoRoot, "public", "manifest.webmanifest"),
      JSON.stringify({
        name: "GrabBots",
        short_name: "GrabBots",
        start_url: "/",
        display: "standalone",
        icons: [{ src: "/app-icon-192.png", sizes: "192x192", type: "image/png" }],
      }),
    );

    const handler = createGrabBotsWorkspaceRoutes({ repoRoot, dataDir });
    const res = await invoke(handler, "GET", "/api/grabbots/downloads");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");

    const payload = res.body as GrabBotsDownloadsPayload;
    expect(payload.product).toBe("GrabBots");
    expect(payload.version).toBe("0.2.0");
    expect(payload.releaseDirExists).toBe(false);

    expect(payload.platforms.windows.available).toBe(false);
    expect(payload.platforms.windows.artifacts).toEqual([]);
    expect(payload.platforms.windows.buildCommand).toBe("pnpm package:win");

    expect(payload.platforms.linux.available).toBe(false);
    expect(payload.platforms.linux.artifacts).toEqual([]);
    expect(payload.platforms.linux.buildCommand).toBe("pnpm package:linux");

    expect(payload.platforms.macos.available).toBe(false);
    expect(payload.platforms.android.available).toBe(false);
    expect(payload.platforms.android.scaffolded).toBe(false);
    expect(payload.platforms.android.buildCommand).toBe("pnpm build:apk");
    expect(payload.platforms.android.cost).toBe("$0");

    expect(payload.platforms.pwa.available).toBe(true);
    expect(payload.platforms.pwa.cost).toBe("$0");
    expect(payload.platforms.pwa.manifest).toEqual({
      name: "GrabBots",
      shortName: "GrabBots",
      startUrl: "/",
      display: "standalone",
      iconsReady: true,
    });

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toMatch(/OpenMausBot|DuskBot/i);
  });

  it("detects real .exe, .AppImage, .deb, .dmg, and .apk artifacts with real sizes", async () => {
    const repoRoot = freshTempDir();
    const dataDir = freshTempDir();
    writeFileSync(join(repoRoot, "package.json"), JSON.stringify({ name: "grabbots", version: "0.2.1" }));
    mkdirSync(join(repoRoot, "release"), { recursive: true });
    writeFileSync(join(repoRoot, "release", "GrabBots-0.2.1-x64.exe"), "1234567890");
    writeFileSync(join(repoRoot, "release", "GrabBots-0.2.1-x64.AppImage"), "linux-appimage");
    writeFileSync(join(repoRoot, "release", "GrabBots-0.2.1-amd64.deb"), "deb");
    writeFileSync(join(repoRoot, "release", "GrabBots-0.2.1-arm64.dmg"), "dmg-data");
    mkdirSync(join(repoRoot, "apps", "android", "app", "build", "outputs", "apk", "release"), { recursive: true });
    writeFileSync(join(repoRoot, "apps", "android", "build-apk.mjs"), "// apk script\n");
    writeFileSync(
      join(repoRoot, "apps", "android", "app", "build", "outputs", "apk", "release", "app-release.apk"),
      "apk-binary",
    );

    const handler = createGrabBotsWorkspaceRoutes({ repoRoot, dataDir });
    const res = await invoke(handler, "GET", "/api/grabbots/downloads");
    expect(res.status).toBe(200);

    const payload = res.body as GrabBotsDownloadsPayload;
    expect(payload.releaseDirExists).toBe(true);
    expect(payload.platforms.windows.available).toBe(true);
    expect(payload.platforms.windows.artifacts).toMatchObject([
      {
        fileName: "GrabBots-0.2.1-x64.exe",
        relativePath: "release/GrabBots-0.2.1-x64.exe",
        extension: ".exe",
        sizeBytes: 10,
      },
    ]);
    expect(payload.platforms.linux.available).toBe(true);
    expect(payload.platforms.linux.artifacts.map((a) => a.extension).sort()).toEqual([".AppImage", ".deb"]);
    expect(payload.platforms.macos.available).toBe(true);
    expect(payload.platforms.macos.artifacts[0]?.relativePath).toBe("release/GrabBots-0.2.1-arm64.dmg");
    expect(payload.platforms.android.available).toBe(true);
    expect(payload.platforms.android.scaffolded).toBe(true);
    expect(payload.platforms.android.artifacts[0]?.relativePath).toBe(
      "apps/android/app/build/outputs/apk/release/app-release.apk",
    );
    expect(payload.platforms.pwa.available).toBe(false);
  });
});

describe("GET /api/grabbots/workspace-files", () => {
  it("lists real workspace, docs, and skills entries and reports missing directories honestly as empty", async () => {
    const repoRoot = freshTempDir();
    const dataDir = freshTempDir();
    mkdirSync(join(dataDir, "workspaces", "zeus"), { recursive: true });
    mkdirSync(join(dataDir, "workspaces", "knull", "src"), { recursive: true });
    writeFileSync(join(dataDir, "workspaces", "zeus", "MEMORY.md"), "# Zeus notes");
    writeFileSync(join(dataDir, "workspaces", "knull", "src", "main.ts"), "export const ok = true;");
    mkdirSync(join(repoRoot, "skills", "research"), { recursive: true });
    writeFileSync(join(repoRoot, "skills", "research", "SKILL.md"), "# Research skill");

    const handler = createGrabBotsWorkspaceRoutes({ repoRoot, dataDir });
    const res = await invoke(handler, "GET", "/api/grabbots/workspace-files");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");

    const payload = res.body as GrabBotsWorkspaceFilesPayload;
    expect(payload.product).toBe("GrabBots");
    expect(payload.activeBotIds).toEqual(["knull", "zeus"]);
    expect(payload.botWorkspaces.map((b) => b.botId)).toEqual(["knull", "zeus"]);
    expect(payload.folders.workspaces.exists).toBe(true);
    expect(payload.folders.workspaces.entries.some((e) => e.relativePath === "zeus/MEMORY.md" && e.sizeBytes === 12)).toBe(true);
    expect(payload.folders.skills.exists).toBe(true);
    expect(payload.folders.skills.entries.some((e) => e.relativePath === "research/SKILL.md")).toBe(true);
    expect(payload.folders.docs.exists).toBe(false);
    expect(payload.folders.docs.entries).toEqual([]);
  });

  it("supports scoped root/path queries via OMB_DATA_DIR and blocks path traversal and symlink escapes", async () => {
    const repoRoot = freshTempDir();
    const dataDir = freshTempDir();
    const outsideDir = freshTempDir();
    writeFileSync(join(outsideDir, "secret.txt"), "do-not-leak");
    mkdirSync(join(dataDir, "workspaces", "zeus"), { recursive: true });
    writeFileSync(join(dataDir, "workspaces", "zeus", "notes.md"), "hello");
    let symlinkCreated = false;
    try {
      symlinkSync(outsideDir, join(dataDir, "workspaces", "escape-link"), "dir");
      symlinkCreated = true;
    } catch {
      // Symlink creation can require elevated rights on some Windows hosts.
    }

    vi.stubEnv("OMB_DATA_DIR", dataDir);
    const handler = createGrabBotsWorkspaceRoutes({ repoRoot });

    const scoped = await invoke(handler, "GET", "/api/grabbots/workspace-files?root=workspaces&path=zeus");
    expect(scoped.status).toBe(200);
    const scopedBody = scoped.body as GrabBotsWorkspaceFilesPayload;
    expect(scopedBody.requestedRoot).toBe("workspaces");
    expect(scopedBody.requestedPath).toBe("zeus");
    expect(scopedBody.listing?.entries).toMatchObject([
      { name: "notes.md", relativePath: "zeus/notes.md", kind: "file", sizeBytes: 5, extension: ".md" },
    ]);

    const badQueries = [
      "/api/grabbots/workspace-files?root=workspaces&path=../secret",
      "/api/grabbots/workspace-files?root=workspaces&path=zeus/../../etc",
      "/api/grabbots/workspace-files?root=workspaces&path=/etc/passwd",
      "/api/grabbots/workspace-files?root=workspaces&path=C:\\Windows",
      ...(symlinkCreated ? ["/api/grabbots/workspace-files?root=workspaces&path=escape-link"] : []),
      "/api/grabbots/workspace-files?root=invalid",
      "/api/grabbots/workspace-files?path=zeus",
    ];
    for (const badQuery of badQueries) {
      const rejected = await invoke(handler, "GET", badQuery);
      expect(rejected.status).toBe(400);
    }
  });

  it("delegates both endpoints cleanly through createGrabBotsOpsRoutes", async () => {
    const repoRoot = freshTempDir();
    const dataDir = freshTempDir();
    writeFileSync(join(repoRoot, "package.json"), JSON.stringify({ name: "grabbots", version: "0.3.0" }));
    mkdirSync(join(dataDir, "workspaces", "kraken"), { recursive: true });
    writeFileSync(join(dataDir, "workspaces", "kraken", "report.md"), "ok");

    const selection = (): ModelSelection => ({ instanceId: "claude", model: "claude-sonnet-5" });
    const store = new Store(selection);
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
    const coordinator = createCoordinator({ dataDir: ":memory:", host: noopHost });

    try {
      const ops = createGrabBotsOpsRoutes({
        store,
        coordinator,
        desktopComputer: createDesktopComputer({ platform: "win32" }),
        instances: () => [],
        snapshot: () => null,
        boxOn: () => false,
        dataDir,
        repoRoot,
      });

      const downloadsRes = await invoke(ops, "GET", "/api/grabbots/downloads");
      expect(downloadsRes.status).toBe(200);
      expect((downloadsRes.body as GrabBotsDownloadsPayload).version).toBe("0.3.0");

      const filesRes = await invoke(ops, "GET", "/api/grabbots/workspace-files");
      expect(filesRes.status).toBe(200);
      expect((filesRes.body as GrabBotsWorkspaceFilesPayload).activeBotIds).toContain("kraken");
    } finally {
      coordinator.close();
    }
  });
});
