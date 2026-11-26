// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FilesView } from "@/components/FilesView";
import { GrabBotsNavRail } from "@/components/GrabBotsNavRail";
import { BotEditorStore, initialState, reducer, type Action, type InstanceInfo, type useStore } from "@/state/store";
import { DownloadsHub } from "./components/DownloadsHub";
import { HeroSection } from "./components/HeroSection";
import { ModernFooter } from "./components/ModernFooter";
import { ProvidersQuickHub } from "./components/ProvidersQuickHub";
import { initialOverviewView } from "./overview-state";
import type { GrabBotsDownloadsPayload, GrabBotsWorkspaceFilesPayload } from "./types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  delete (window as { ogb?: unknown }).ogb;
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

const downloadsPayload = (windowsAvailable = false): GrabBotsDownloadsPayload => ({
  product: "GrabBots",
  version: "0.1.177",
  checkedAt: 1,
  releaseDirExists: windowsAvailable,
  platforms: {
    windows: {
      id: "windows",
      label: "Windows",
      available: windowsAvailable,
      cost: "Free (open source)",
      costNote: "Built locally via NSIS.",
      buildCommand: "pnpm package:win",
      extensions: [".exe"],
      artifacts: windowsAvailable
        ? [{ fileName: "GrabBots-0.1.177-x64.exe", relativePath: "release/GrabBots-0.1.177-x64.exe", extension: ".exe", sizeBytes: 1024 * 1024, modifiedAt: "2026-11-25T00:00:00.000Z" }]
        : [],
      notes: windowsAvailable ? "Found 1 Windows installer." : "Run pnpm package:win to build locally.",
    },
    linux: {
      id: "linux",
      label: "Linux",
      available: false,
      cost: "Free (open source)",
      costNote: "Built locally.",
      buildCommand: "pnpm package:linux",
      extensions: [".AppImage", ".deb"],
      artifacts: [],
      notes: "Run pnpm package:linux to build locally.",
    },
    macos: {
      id: "macos",
      label: "macOS",
      available: false,
      cost: "Free (open source)",
      costNote: "Built locally.",
      buildCommand: "pnpm package:mac",
      extensions: [".dmg"],
      artifacts: [],
      notes: "Run pnpm package:mac on macOS.",
    },
    android: {
      id: "android",
      label: "Android APK",
      available: false,
      cost: "$0",
      costNote: "$0 free Capacitor build.",
      buildCommand: "pnpm build:apk",
      extensions: [".apk"],
      artifacts: [],
      scaffolded: true,
      notes: "Android Capacitor project scaffolded at apps/android/.",
    },
    pwa: {
      id: "pwa",
      label: "Web PWA",
      available: true,
      cost: "$0",
      costNote: "$0 browser install.",
      buildCommand: "pnpm build",
      extensions: [".webmanifest"],
      artifacts: [],
      manifestPath: "public/manifest.webmanifest",
      manifest: { name: "GrabBots", shortName: "GrabBots", startUrl: "/", display: "standalone", iconsReady: true },
      notes: "Web app manifest ready.",
    },
  },
});

const workspacePayload: GrabBotsWorkspaceFilesPayload = {
  product: "GrabBots",
  collectedAt: 1,
  requestedRoot: null,
  requestedPath: null,
  activeBotIds: ["zeus", "kraken", "knull", "xerxes"],
  botWorkspaces: [
    {
      botId: "zeus",
      relativePath: "zeus",
      fileCount: 2,
      totalBytes: 2048,
      modifiedAt: "2026-11-25T00:00:00.000Z",
      entries: [],
    },
  ],
  folders: {
    workspaces: { root: "workspaces", label: "Bot Workspaces", exists: true, totalEntries: 1, fileCount: 2, directoryCount: 1, totalBytes: 2048, truncated: false, entries: [] },
    docs: { root: "docs", label: "Workspace Docs", exists: true, totalEntries: 3, fileCount: 3, directoryCount: 0, totalBytes: 4096, truncated: false, entries: [] },
    skills: { root: "skills", label: "Skills Library", exists: true, totalEntries: 2, fileCount: 0, directoryCount: 2, totalBytes: 0, truncated: false, entries: [] },
  },
};

describe("GrabBots overview & integrations", () => {
  it("HeroSection renders all 4 GrabBots avatars, clean copy, and actions", () => {
    const onOpenChat = vi.fn();
    act(() => root.render(createElement(HeroSection, { onOpenChat })));
    const text = host.textContent ?? "";
    for (const name of ["Zeus", "Kraken", "Knull", "Xerxes"]) expect(text).toContain(name);
    expect(text).toContain("Open Squad Chat");
    expect(text).toContain("Windows");
    expect(text).toContain("Linux");
    expect(text).toContain("Android APK");
    expect(text).not.toMatch(/OpenMausBot|MausBot|DuskBot|—/);
    expect(host.querySelectorAll("[data-open-avatar]")).toHaveLength(4);
  });

  it("ProvidersQuickHub reflects real state.instances statuses and opens engines settings", () => {
    const onOpenEngines = vi.fn();
    const instances: InstanceInfo[] = [
      { instanceId: "claude", driverKind: "claudeAgent", displayName: "Claude", snapshot: { state: "available", authenticated: true, account: { email: "dev@grabbots.app" } }, models: { default: "sonnet", options: [{ id: "sonnet", label: "Sonnet" }] } },
      { instanceId: "codex", driverKind: "codex", displayName: "Codex", snapshot: { state: "available", authenticated: false }, models: { default: "gpt-5", options: [] } },
    ];
    act(() => root.render(createElement(ProvidersQuickHub, { instances, onOpenEngines })));
    expect(host.textContent).toContain("1 of 2 configured providers ready");
    expect(host.textContent).toContain("Ready");
    expect(host.textContent).toContain("Sign-in required");
    expect(host.textContent).toContain("dev@grabbots.app");
    const manage = [...host.querySelectorAll("button")].find((btn) => btn.textContent?.includes("Manage"));
    act(() => manage!.click());
    expect(onOpenEngines).toHaveBeenCalledOnce();
  });

  it("DownloadsHub loads /api/grabbots/downloads and renders honest commands or ready binaries", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(downloadsPayload(false)), { status: 200 })));
    await act(async () => root.render(createElement(DownloadsHub)));
    expect(host.textContent).toContain("pnpm package:win");
    expect(host.textContent).toContain("pnpm package:linux");
    expect(host.textContent).toContain("pnpm build:apk");
    expect(host.textContent).toContain("$0 APK + Web PWA");

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(downloadsPayload(true)), { status: 200 })));
    await act(async () => root.render(createElement(DownloadsHub)));
    const refresh = [...host.querySelectorAll("button")].find((btn) => btn.textContent?.includes("Refresh"));
    await act(async () => refresh!.click());
    expect(host.textContent).toContain("GrabBots-0.1.177-x64.exe");
    expect(host.textContent).toContain("Ready on disk");
  });

  it("ModernFooter contains GrabBots navigation links and zero retired brand names", () => {
    act(() => root.render(createElement(ModernFooter, {
      onOpenOverview: vi.fn(),
      onOpenChat: vi.fn(),
      onOpenProviders: vi.fn(),
      onOpenFiles: vi.fn(),
    })));
    const text = host.textContent ?? "";
    expect(text).toContain("GrabBots");
    expect(text).toContain("Overview");
    expect(text).toContain("Squad Chat");
    expect(text).toContain("Model Providers");
    expect(text).toContain("Files");
    expect(text).toContain("Login / Pair");
    expect(text).not.toMatch(/OpenMausBot|MausBot|DuskBot/);
  });

  it("GrabBotsNavRail and store reducer support the overview view", () => {
    const dispatch = vi.fn();
    const store = { state: { ...initialState, activeView: "overview" as const }, dispatch } as unknown as ReturnType<typeof useStore>;
    act(() => root.render(createElement(BotEditorStore, { value: store, children: createElement(GrabBotsNavRail) })));
    const overviewBtn = host.querySelector<HTMLButtonElement>('button[aria-label="Overview"]')!;
    expect(overviewBtn.getAttribute("aria-current")).toBe("page");
    act(() => overviewBtn.click());
    expect(dispatch).toHaveBeenCalledWith({ type: "showOverview" });

    const next = reducer({ ...initialState, activeView: "chat", settingsOpen: true }, { type: "showOverview" } satisfies Action);
    expect(next.activeView).toBe("overview");
    expect(next.settingsOpen).toBe(false);

    window.history.replaceState(null, "", "/?view=overview");
    expect(initialOverviewView()).toBe("overview");

    const originalLocation = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: undefined });
    try {
      expect(initialOverviewView()).toBe("chat");
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    }
  });

  it("FilesView on standalone web fetches /api/grabbots/workspace-files without dead Cloud settings button", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(workspacePayload), { status: 200 })));
    const dispatch = vi.fn();
    const store = { state: initialState, dispatch } as unknown as ReturnType<typeof useStore>;
    await act(async () => root.render(createElement(BotEditorStore, { value: store, children: createElement(FilesView) })));
    expect(host.textContent).toContain("Bot Workspaces");
    expect(host.textContent).toContain("Workspace Docs");
    expect(host.textContent).toContain("Skills Library");
    expect(host.textContent).toContain("4 active squad bots on this host.");
    expect(host.textContent).not.toContain("Open GrabBots Cloud settings");
  });
});
