import { InteractiveBotAvatar } from "@/components/InteractiveBotAvatar";
import { brand, productName } from "@/lib/brand";
import { t } from "@/lib/i18n";

/** The first-run welcome card: strictly the Cat mascot in a curved header, no chat composer or model-provider buttons. */
export function MeetScreen({ hosted, onNext }: { hosted: boolean; onNext: () => void }) {
  const logo = brand().logo;
  return (
    <div className="flex h-full min-h-[600px] w-full items-center justify-center bg-[#DCE3E8] px-4 py-8 dark:bg-[#09090b]">
      <div className="w-full max-w-[420px] overflow-hidden rounded-[28px] border border-black/10 bg-card shadow-[0_24px_60px_-14px_rgba(0,0,0,0.28)] dark:border-white/10">
        <div
          className="relative overflow-hidden px-7 pb-12 pt-9 text-white"
          style={{
            background: "radial-gradient(circle at 12% 85%, rgba(226,188,108,0.65) 0%, transparent 45%), radial-gradient(circle at 92% 90%, rgba(92,184,132,0.58) 0%, transparent 48%), linear-gradient(145deg, #E27150 0%, #D46042 52%, #C65339 100%)",
          }}
        >
          <div className="relative z-10 flex flex-col items-center gap-3 text-center">
            <div className="flex size-20 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/35 shadow-sm backdrop-blur-md">
              {logo ? (
                <img src={logo} alt="" width={56} height={56} className="size-14 object-contain" />
              ) : (
                <InteractiveBotAvatar type="cat" color="orange" state="done" size={58} hoverActive />
              )}
            </div>
            <h1 id="welcome-title" className="text-[24px] font-normal leading-[30px] tracking-[-0.02em] text-white">
              {t("onboarding.meet.title", { app: productName() })}
            </h1>
          </div>
        </div>
        <div className="relative z-10 -mt-6 flex flex-col items-center rounded-t-[28px] bg-card px-7 pb-7 pt-6 text-center">
          <p className="text-[14px] leading-relaxed text-ink-secondary">
            {hosted
              ? t("onboarding.hosted.intro")
              : "Your local AI squad is ready. Connect any model provider anytime in Settings."}
          </p>
          <button
            type="button"
            data-primary=""
            onClick={onNext}
            className="mt-6 w-full rounded-full bg-[#09090b] px-5 py-3 text-[14px] font-medium text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-[#09090b]"
          >
            {t("onboarding.meet.next")}
          </button>
        </div>
      </div>
    </div>
  );
}
