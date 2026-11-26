import { useRef } from "react";
import { ArrowRight, FolderOpen } from "lucide-react";

import { WindowDragStrip } from "@/components/DesktopCapabilities";
import { useStore } from "@/state/store";
import { DownloadsHub } from "./DownloadsHub";
import { HeroSection } from "./HeroSection";
import { ModernFooter } from "./ModernFooter";

function markEnteredChat() {
  try {
    sessionStorage.setItem("grabbots-entered-chat", "1");
  } catch {
    // Ignore storage errors in restricted browser contexts.
  }
}

export function GrabBotsOverviewPage() {
  const { state, dispatch } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const botIdsAvailable = new Set(state.bots.filter((bot) => !bot.hidden).map((bot) => bot.id));

  const openSquadChat = (botId?: string) => {
    markEnteredChat();
    if (botId && botIdsAvailable.has(botId)) {
      dispatch({ type: "select", id: botId });
      return;
    }
    dispatch({ type: "showChat" });
  };

  const openProviders = () => {
    dispatch({ type: "toggleAppSettings", open: true, section: "engines" });
  };

  const openFiles = () => {
    dispatch({ type: "showFiles" });
  };

  const jumpToDownloads = () => {
    const target = scrollRef.current?.querySelector("#grabbots-downloads-hub");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main
      data-grabbots-overview=""
      className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-app text-ink"
    >
      <header className="relative flex shrink-0 items-center justify-between gap-3 border-b border-hairline/40 px-6 py-3.5 max-md:pl-14">
        <WindowDragStrip />
        <div className="flex min-w-0 items-center gap-2.5">
          <img
            src="/app-icon.svg"
            alt=""
            width={24}
            height={24}
            className="size-6 shrink-0 rounded-[6px] object-contain"
          />
          <span className="truncate text-[15px] font-semibold text-ink">GrabBots Overview</span>
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <button type="button" onClick={openFiles} className="ui-button ui-button-sm gap-1.5">
            <FolderOpen size={13} aria-hidden="true" />
            <span>Files</span>
          </button>
          <button
            type="button"
            onClick={() => openSquadChat()}
            className="ui-button ui-button-sm ui-button-primary gap-1.5"
          >
            <span>Enter Workspace Chat</span>
            <ArrowRight size={13} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-6">
          <HeroSection
            onOpenChat={openSquadChat}
            onJumpToDownloads={jumpToDownloads}
            botIdsAvailable={botIdsAvailable.size > 0 ? botIdsAvailable : undefined}
          />

          <DownloadsHub />

          <section
            aria-label="License"
            className="rounded-[24px] border border-[#f0d98c] bg-[#fef5d4] p-6 text-[#1a1814] sm:p-8"
          >
            <p className="text-[15px] font-semibold leading-snug">
              grabbots&apos;s code is free for personal, non-commercial use. commercial use is not allowed without a separate written license from us.
            </p>
            <div className="mt-5 grid gap-4 text-[13px] leading-relaxed sm:grid-cols-[140px_1fr]">
              <div className="font-semibold">you can</div>
              <div>
                read the code, run grabbots, change it and share it, for personal and other noncommercial use. anyone you share it with must also get the license and its required notice.
              </div>
              <div className="font-semibold">you can&apos;t</div>
              <div>
                use it, or a changed copy, for commercial purposes without our license: at or for a business, inside a product, or as a commercial service. this applies to every version, including older copies.
              </div>
              <div className="font-semibold">commercial license</div>
              <div>hello@grabbots.app</div>
            </div>
            <p className="mt-5 text-[12px] text-[#4a4335]">
              the license is the polyform noncommercial license 1.0.0.
            </p>
          </section>

          <ModernFooter
            onOpenOverview={scrollToTop}
            onOpenChat={() => openSquadChat()}
            onOpenProviders={openProviders}
            onOpenFiles={openFiles}
          />
        </div>
      </div>
    </main>
  );
}
