import { t } from "@/lib/i18n";
import type { Bot } from "@/state/store";

export function EmptyChat({ bot }: { bot: Bot }) {
  return (
    <div className="flex flex-1" data-empty-chat={bot.id}>
      <span role="status" className="sr-only">{t("chat.emptyPrompt")}</span>
    </div>
  );
}
