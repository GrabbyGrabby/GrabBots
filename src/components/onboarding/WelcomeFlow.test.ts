// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { introStaged, stageIntro, useChiefStepOpen } from "@/lib/default-bot";
import { setLocale } from "@/lib/i18n";
import { WHATS_NEW_NOTICE } from "@/lib/notices";
import { EMPTY_ONBOARDING, MET_CHIEF_HINT, WELCOME_VERSION } from "@/lib/onboarding";
import { saveWelcomeDraft } from "@/lib/welcome-draft";
import type { InstanceInfo } from "@/state/store";

const f = vi.hoisted(() => ({ state: {} as Record<string, unknown>, dispatch: vi.fn(), api: vi.fn(), landed: vi.fn(), onDone: vi.fn() }));
vi.mock("@/state/store", () => ({ useStore: () => ({ state: f.state, dispatch: f.dispatch }), api: f.api }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn(), setEmailGateDone: vi.fn() }));
vi.mock("@/components/Avatar", () => ({ BotAvatar: () => null, MausAvatar: () => null }));
vi.mock("@/components/InteractiveBotAvatar", () => ({
  InteractiveBotAvatar: ({ type }: { type: string }) => createElement("span", { "data-open-avatar": type }),
}));
vi.mock("@/components/mascot-clock", () => ({ usePrefersReducedMotion: () => true }));
vi.mock("@/lib/default-bot", async (original) => ({ ...(await original<typeof import("@/lib/default-bot")>()), useViewerEmail: () => null }));
vi.mock("@/lib/mausbot-landing", () => ({ FLIGHT_MS: 700, landInSidebar: (input: { botId: string; commit: () => void }) => { f.landed(input.botId); input.commit(); } }));
const { WelcomeFlow } = await import("./WelcomeFlow");
const { CHIEF_FADE_MS, CHIEF_GUARD_MS } = await import("./ChiefIntro");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const claude = (ready: boolean): InstanceInfo => ({
  instanceId: "claude", driverKind: "claudeAgent", displayName: "Claude", install: { docsUrl: "https://example.test" },
  snapshot: { state: ready ? "available" : "unavailable", authenticated: ready }, models: { default: "m", options: [] },
});
const maus = { id: "maus", threadId: "t", name: "GrabBot", title: "", description: "", notifications: true, color: "chrome", unread: false,
  modelSelection: { instanceId: "claude", model: "m" }, messages: [], defaultBot: {}, chiefOfStaff: true };

let host: HTMLDivElement, root: Root;
let chiefStep = false;
function Watch() {
  chiefStep = useChiefStepOpen();
  return null;
}
const text = () => host.textContent ?? "";
const button = (label: string) => [...host.querySelectorAll("button")].find((node) => node.textContent === label);
const press = async (label: string) => { await act(async () => { button(label)!.click(); }); };
const tick = async (ms: number) => { await act(async () => { vi.advanceTimersByTime(ms); }); };
const show = async (extra: Record<string, unknown> = {}) => {
  await act(async () => { root.render([createElement(Watch, { key: "w" }), createElement(WelcomeFlow, { key: "f", onDone: f.onDone, ...extra })]); });
};
const toChief = async (label = "Next") => {
  await press(label);
  await tick(100);
  await tick(CHIEF_GUARD_MS);
};
const saved = () => f.api.mock.calls.filter(([path, init]) => path === "/api/config" && init?.method === "PUT").map(([, init]) => JSON.parse(init.body));
const memoryStorage = () => {
  const values = new Map<string, string>();
  return { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => void values.set(k, String(v)), removeItem: (k: string) => void values.delete(k), clear: () => values.clear() };
};

beforeEach(() => {
  vi.useFakeTimers();
  HTMLElement.prototype.animate = vi.fn(() => ({ onfinish: null, oncancel: null, cancel() {} }) as unknown as Animation);
  setLocale("en");
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("sessionStorage", memoryStorage());
  f.dispatch.mockReset();
  f.landed.mockReset();
  f.onDone.mockReset();
  f.api.mockReset();
  f.api.mockImplementation(async (_path: string, init?: { body?: string }) => JSON.parse(init?.body ?? "{}"));
  f.state = { instances: [claude(true)], config: { onboarding: EMPTY_ONBOARDING, profile: { name: "" } }, bots: [maus], cloudAdd: null };
  stageIntro(null);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("a new install's first run", () => {
  it("shows only the cat mascot with no chat UI or provider connect buttons, then moves to Chief setup", async () => {
    await show();
    expect(host.querySelector("h1")?.textContent).toBe("Meet GrabBots");
    const avatars = [...host.querySelectorAll("[data-open-avatar]")].map((n) => n.getAttribute("data-open-avatar"));
    expect(avatars).toEqual(["cat"]);
    expect(host.querySelector("[data-demo-composer]")).toBeNull();
    expect(host.querySelector("[data-first-ais]")).toBeNull();
    for (const gone of ["Connect Claude", "Sign in with ChatGPT", "Install OpenCode"]) expect(text()).not.toContain(gone);
    expect(button("Next")!.disabled).toBe(false);

    await press("Next");
    expect(host.querySelector("[data-welcome]")?.getAttribute("data-welcome")).toBe("meet");
    await tick(100);
    expect(host.querySelector("[role=dialog]")?.textContent).toContain("Introducing your Chief of Staff");
    expect(host.querySelector("[data-welcome]")!.className).toContain("ui-scrim");
    expect(chiefStep).toBe(true);

    await tick(CHIEF_GUARD_MS);
    await press("Create Chief of Staff");
    expect(f.landed).toHaveBeenCalledWith("maus");
    expect(f.dispatch).toHaveBeenCalledWith({ type: "updateBot", botId: "maus", patch: { welcomed: true } });
    await tick(CHIEF_FADE_MS);
    expect(f.onDone).toHaveBeenCalledExactlyOnceWith("maus");
    expect(introStaged("maus")).toBe(true);
    await act(async () => {});
    expect(saved()).toEqual([{ onboarding: expect.objectContaining({ version: WELCOME_VERSION, hintsSeen: [MET_CHIEF_HINT] }) }]);
  });

  it("comes back to the second screen after a reload there", async () => {
    saveWelcomeDraft({ beat: "chief" });
    await show();
    expect(text()).toContain("Introducing your Chief of Staff");
  });
});

describe("the Chief step", () => {
  const finishesAtNext = async () => {
    await show();
    await press("Next");
    await tick(100);
    expect(text()).not.toContain("Introducing your Chief of Staff");
    expect(f.onDone).toHaveBeenCalledExactlyOnceWith(null);
    expect(chiefStep).toBe(false);
  };

  it("is skipped once the default bot has met the person", async () => {
    f.state = { ...f.state, bots: [{ ...maus, welcomed: true }] };
    await finishesAtNext();
  });

  it("is skipped where another bot is already the Chief", async () => {
    f.state = { ...f.state, bots: [{ ...maus, chiefOfStaff: false }, { ...maus, id: "research", threadId: "r", name: "Research", defaultBot: undefined, chiefOfStaff: true }] };
    await finishesAtNext();
  });

  it("is skipped where there is no default bot", async () => {
    f.state = { ...f.state, bots: [] };
    await finishesAtNext();
  });
});

describe("What's new and replay", () => {
  it("keeps desktop notices untouched during first run", async () => {
    const seen = vi.fn(async () => {});
    vi.stubGlobal("ogb", { remoteClient: { active: false }, cloudAccount: { offer: vi.fn() }, desktopNotices: { seen } });
    await show();
    await toChief();
    await press("Create Chief of Staff");
    await tick(CHIEF_FADE_MS);
    await act(async () => {});
    expect(seen).not.toHaveBeenCalled();
    expect(saved()[0].onboarding.hintsSeen).toEqual([MET_CHIEF_HINT]);
    expect(localStorage.getItem(WHATS_NEW_NOTICE)).toBeNull();
  });

  it("gives a hosted place's admin the first screen only, then the chat", async () => {
    await show({ hosted: true });
    expect(text()).toContain("This is your team's shared GrabBots");
    await press("Next");
    expect(text()).not.toContain("Introducing your Chief of Staff");
    expect(f.onDone).toHaveBeenCalledExactlyOnceWith(null);
  });

  it("a replay from Settings records nothing about a first chat", async () => {
    f.state = { ...f.state, config: { onboarding: { ...EMPTY_ONBOARDING, completedAt: "2026-09-01T00:00:00.000Z", version: WELCOME_VERSION } } };
    await show({ replay: true });
    await toChief();
    await press("Create Chief of Staff");
    await tick(CHIEF_FADE_MS);
    await act(async () => {});
    expect(saved()[0].onboarding).not.toHaveProperty("hintsSeen");
    expect(introStaged("maus")).toBe(false);
  });
});
