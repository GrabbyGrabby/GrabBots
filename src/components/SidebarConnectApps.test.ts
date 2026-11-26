import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { initialState } from "@/state/store";

vi.mock("@/state/store", async (original) => ({ ...await original<typeof import("@/state/store")>(), useStore: () => ({ state: initialState, dispatch: vi.fn() }) }));

import { APP_FACES, POPULAR_APPS, SidebarConnectApps, appFaces } from "./SidebarConnectApps";

const card = (slug: string) => ({ slug, label: slug, logo: `https://logos.example/${slug}.png`, domain: null });

describe("the Connect apps faces", () => {
  it("shows no placeholder logos until an app is connected", () => {
    expect(POPULAR_APPS).toEqual([]);
    expect(appFaces([], new Map())).toEqual([]);
  });

  it("renders only connected apps, never showing more than three", () => {
    const cards = new Map([["github", card("github")], ["gmail", card("gmail")]]);
    expect(appFaces(["github", "gmail"], cards).map((face) => face.slug)).toEqual(["github", "gmail"]);
    const many = new Map(["a", "b", "c", "d"].map((slug) => [slug, card(slug)]));
    expect(appFaces(["a", "b", "c", "d"], many)).toHaveLength(APP_FACES);
  });

  it("draws a 36px pill with a 14px medium label and omits fake logos when nothing is connected", () => {
    const html = renderToStaticMarkup(createElement(SidebarConnectApps));
    expect(html).toMatch(/class="group\/apps flex h-9 min-w-0 flex-1 items-center justify-center gap-1\.5 rounded-full pl-4 pr-3 text-\[14px\] font-medium leading-5 text-ink /);
    expect(html).not.toContain("data-app-face=");
  });

  it("never cuts its label short when no logos are shown", () => {
    const html = renderToStaticMarkup(createElement(SidebarConnectApps));
    const label = /<span data-apps-label="" class="([^"]*)">Connect apps<\/span>/.exec(html)?.[1]?.split(" ");
    expect(label).toEqual(expect.arrayContaining(["shrink-0", "whitespace-nowrap"]));
    expect(label).not.toContain("truncate");
    expect(label).not.toContain("min-w-0");
  });

  it("is a round 36px puzzle button on the collapsed rail, named for screen readers", () => {
    const html = renderToStaticMarkup(createElement(SidebarConnectApps, { circle: true }));
    expect(html).toMatch(/data-tour="nav-apps"[^>]*aria-label="Connect apps" title="Connect apps" class="[^"]*\bsize-9\b[^"]*\brounded-full\b/);
    expect(html).toContain("lucide-puzzle");
    expect(html).not.toContain("data-app-face");
  });

  it("keeps a connected app it cannot draw yet out", () => {
    expect(appFaces(["linear"], new Map())).toEqual([]);
  });
});
