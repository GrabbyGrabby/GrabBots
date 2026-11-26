import { Cpu, FolderOpen, Home, MessageSquare, Puzzle, Settings, Zap } from "lucide-react";

import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { useStore } from "@/state/store";
import { BotAvatar } from "./Avatar";

interface RailItem {
  id: string;
  label: string;
  active: boolean;
  onClick: () => void;
  icon: typeof MessageSquare;
}

/** Outer navigation strip framing the rounded GrabBots app surface. */
export function GrabBotsNavRail() {
  const { state, dispatch } = useStore();
  const activeBot = state.bots.find((b) => b.id === state.selectedId) ?? state.bots[0];
  const onOverview = state.activeView === "overview" && !state.pluginsOpen && !state.appSettingsOpen;
  const onChat = state.activeView === "chat" && !state.pluginsOpen && !state.appSettingsOpen;

  const items: RailItem[] = [
    {
      id: "overview",
      label: "Overview",
      active: onOverview,
      icon: Home,
      onClick: () => dispatch({ type: "showOverview" }),
    },
    {
      id: "chat",
      label: "Squad",
      active: onChat,
      icon: MessageSquare,
      onClick: () => dispatch({ type: "showChat" }),
    },
    {
      id: "engines",
      label: t("settings.engines.title"),
      active: state.appSettingsOpen && state.appSettingsSection === "engines",
      icon: Cpu,
      onClick: () => dispatch({ type: "toggleAppSettings", open: true, section: "engines" }),
    },
    {
      id: "files",
      label: t("sidebar.nav.files"),
      active: state.activeView === "files",
      icon: FolderOpen,
      onClick: () => dispatch({ type: "showFiles" }),
    },
    {
      id: "automations",
      label: t("sidebar.nav.automations"),
      active: state.activeView === "routines",
      icon: Zap,
      onClick: () => dispatch({ type: "showRoutines", view: "list" }),
    },
    {
      id: "apps",
      label: t("sidebar.nav.apps"),
      active: state.pluginsOpen,
      icon: Puzzle,
      onClick: () => dispatch({ type: "togglePlugins", open: true }),
    },
  ];

  return (
    <nav
      data-grabbots-nav-rail=""
      aria-label="Workspace navigation"
      className="hidden w-[52px] shrink-0 flex-col items-center justify-between bg-[#060608] py-3 text-white/75 select-none md:flex"
    >
      <div className="flex flex-col items-center gap-2.5">
        <button
          type="button"
          onClick={() => dispatch({ type: "showOverview" })}
          title="GrabBots Overview"
          aria-label="GrabBots Overview"
          className="mb-1 flex size-8 items-center justify-center rounded-[10px] transition-transform hover:scale-105"
        >
          <img src="/app-icon.svg" alt="" width={28} height={28} className="size-7 rounded-[8px] object-contain" />
        </button>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              title={item.label}
              aria-label={item.label}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex size-9 items-center justify-center rounded-xl transition-colors",
                item.active
                  ? "bg-white text-[#060608] shadow-sm"
                  : "text-white/60 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon size={17} strokeWidth={1.85} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => dispatch({ type: "toggleAppSettings", open: true, section: "general" })}
          title="Settings"
          aria-label="Settings"
          aria-pressed={state.appSettingsOpen}
          className={cn(
            "flex size-9 items-center justify-center rounded-xl transition-colors",
            state.appSettingsOpen ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/10 hover:text-white",
          )}
        >
          <Settings size={17} strokeWidth={1.85} aria-hidden="true" />
        </button>
        {activeBot && (
          <button
            type="button"
            onClick={() => dispatch({ type: "select", id: activeBot.id })}
            title={activeBot.name}
            aria-label={activeBot.name}
            className="flex size-9 items-center justify-center rounded-full bg-white/10 p-0.5 ring-1 ring-white/15 transition-transform hover:scale-105"
          >
            <BotAvatar bot={activeBot} size={26} state={activeBot.busy ? "working" : "idle"} motion="none" motionKey={0} />
          </button>
        )}
      </div>
    </nav>
  );
}
