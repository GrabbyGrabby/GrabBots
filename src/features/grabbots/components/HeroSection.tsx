import { useState } from "react";
import { ArrowRight, Download, MessageSquare, Monitor, Smartphone, Terminal } from "lucide-react";

import { InteractiveBotAvatar } from "@/components/InteractiveBotAvatar";
import { cn } from "@/lib/cn";

export interface SquadHeroBot {
  id: string;
  name: string;
  role: string;
  caption: string;
  type: "bunny" | "egg" | "cat" | "controller";
  color: string;
  tintClass: string;
}

export const GRABBOTS_HERO_BOTS: readonly SquadHeroBot[] = [
  {
    id: "zeus",
    name: "Zeus",
    role: "Chief of Staff",
    caption: "Coordinates tasks and routes multi-step work across your squad.",
    type: "bunny",
    color: "#377FE6",
    tintClass: "from-[#377FE6]/12 via-transparent to-transparent",
  },
  {
    id: "kraken",
    name: "Kraken",
    role: "Web & Research",
    caption: "Extracts web pages, docs, and structured facts cleanly.",
    type: "egg",
    color: "#0EA5C6",
    tintClass: "from-[#0EA5C6]/12 via-transparent to-transparent",
  },
  {
    id: "knull",
    name: "Knull",
    role: "Systems & Code",
    caption: "Builds software, runs verified shell checks, and ships fixes.",
    type: "cat",
    color: "#ff6a1a",
    tintClass: "from-[#ff6a1a]/12 via-transparent to-transparent",
  },
  {
    id: "xerxes",
    name: "Xerxes",
    role: "Operations & Strategy",
    caption: "Runs repeatable workflows, audits results, and tracks routines.",
    type: "controller",
    color: "#14b3b0",
    tintClass: "from-[#14b3b0]/12 via-transparent to-transparent",
  },
];

export interface HeroSectionProps {
  onOpenChat: (botId?: string) => void;
  onJumpToDownloads?: () => void;
  botIdsAvailable?: ReadonlySet<string>;
}

export function HeroSection({ onOpenChat, onJumpToDownloads, botIdsAvailable }: HeroSectionProps) {
  const [hoveredBotId, setHoveredBotId] = useState<string | null>(null);

  return (
    <section
      aria-labelledby="grabbots-hero-title"
      className="relative overflow-hidden rounded-[26px] border border-hairline/45 bg-card p-6 sm:p-8"
    >
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-hairline/50 bg-panel px-3 py-1 text-[12px] font-medium text-ink-secondary">
            <img src="/app-icon.svg" alt="" width={16} height={16} className="size-4 rounded-[4px] object-contain" />
            <span>GrabBots</span>
          </div>

          <h1
            id="grabbots-hero-title"
            className="mt-4 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[32px]"
          >
            Your autonomous AI squad, running locally on your machine.
          </h1>

          <p className="mt-3 text-[14px] leading-relaxed text-ink-secondary">
            Zeus, Kraken, Knull, and Xerxes share context, execute real tools, and keep your data on your device.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onOpenChat()}
              className="ui-button ui-button-primary ui-button-pill gap-2 px-4 py-2"
            >
              <MessageSquare size={15} aria-hidden="true" />
              <span>Open Squad Chat</span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onJumpToDownloads}
              className="ui-button ui-button-pill gap-2 px-3.5 py-2"
            >
              <Monitor size={14} aria-hidden="true" />
              <span>Windows</span>
              <Download size={13} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onJumpToDownloads}
              className="ui-button ui-button-pill gap-2 px-3.5 py-2"
            >
              <Terminal size={14} aria-hidden="true" />
              <span>Linux</span>
              <Download size={13} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onJumpToDownloads}
              className="ui-button ui-button-pill gap-2 px-3.5 py-2"
            >
              <Smartphone size={14} aria-hidden="true" />
              <span>Android APK</span>
              <Download size={13} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:w-[460px] lg:shrink-0">
          {GRABBOTS_HERO_BOTS.map((bot) => {
            const hovered = hoveredBotId === bot.id;
            const selectable = !botIdsAvailable || botIdsAvailable.has(bot.id);
            return (
              <button
                key={bot.id}
                type="button"
                data-hero-bot={bot.id}
                onPointerEnter={() => setHoveredBotId(bot.id)}
                onPointerLeave={() => setHoveredBotId((prev) => (prev === bot.id ? null : prev))}
                onFocus={() => setHoveredBotId(bot.id)}
                onBlur={() => setHoveredBotId((prev) => (prev === bot.id ? null : prev))}
                onClick={() => onOpenChat(selectable ? bot.id : undefined)}
                className={cn(
                  "relative flex items-start gap-3.5 overflow-hidden rounded-[22px] border border-hairline/45 bg-panel/85 p-4 text-left transition-colors hover:border-hairline hover:bg-raised",
                )}
              >
                <div
                  aria-hidden="true"
                  className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80", bot.tintClass)}
                />
                <div className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl border border-hairline/40 bg-card">
                  <InteractiveBotAvatar
                    type={bot.type}
                    color={bot.color}
                    name={bot.name}
                    size={40}
                    hoverActive
                    state={hovered ? "celebrate" : "idle"}
                  />
                </div>
                <div className="relative min-w-0 flex-1">
                  <div className="flex flex-col">
                    <span className="text-[14px] font-semibold leading-tight text-ink">{bot.name}</span>
                    <span className="mt-0.5 text-[11px] font-medium text-ink-tertiary">{bot.role}</span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-ink-secondary">{bot.caption}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
