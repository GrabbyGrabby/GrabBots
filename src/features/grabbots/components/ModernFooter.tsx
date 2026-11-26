export interface ModernFooterProps {
  onOpenOverview: () => void;
  onOpenChat: () => void;
  onOpenProviders: () => void;
  onOpenFiles: () => void;
}

export function ModernFooter({
  onOpenOverview,
  onOpenChat,
  onOpenProviders,
  onOpenFiles,
}: ModernFooterProps) {
  return (
    <footer
      data-grabbots-footer=""
      className="flex flex-col gap-4 rounded-[24px] border border-hairline/45 bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-3">
        <img
          src="/app-icon.svg"
          alt="GrabBots"
          width={28}
          height={28}
          className="size-7 shrink-0 rounded-[8px] object-contain"
        />
        <div>
          <div className="text-[14px] font-semibold text-ink">GrabBots</div>
          <div className="text-[12px] text-ink-secondary">Local-first multi-bot studio</div>
        </div>
      </div>

      <nav aria-label="GrabBots quick links" className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={onOpenOverview} className="ui-button ui-button-sm">
          Overview
        </button>
        <button type="button" onClick={onOpenChat} className="ui-button ui-button-sm">
          Squad Chat
        </button>
        <button type="button" onClick={onOpenProviders} className="ui-button ui-button-sm">
          Model Providers
        </button>
        <button type="button" onClick={onOpenFiles} className="ui-button ui-button-sm">
          Files
        </button>
        <a href="/pair" className="ui-button ui-button-sm no-underline">
          Login / Pair
        </a>
      </nav>
    </footer>
  );
}
