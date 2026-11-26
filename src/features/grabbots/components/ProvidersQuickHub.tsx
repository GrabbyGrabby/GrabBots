import { ArrowUpRight, Check, Cpu } from "lucide-react";

import { engineReady, providerName } from "@/components/EngineLibrary";
import { InteractiveBotAvatar } from "@/components/InteractiveBotAvatar";
import { InstanceProviderMark } from "@/components/ProviderIcons";
import { cn } from "@/lib/cn";
import type { InstanceInfo } from "@/state/store";

const SQUAD_COMPANIONS: ReadonlyArray<{ type: "bunny" | "egg" | "cat" | "controller"; color: string; name: string }> = [
  { type: "bunny", color: "#377FE6", name: "Zeus" },
  { type: "egg", color: "#0EA5C6", name: "Kraken" },
  { type: "cat", color: "#ff6a1a", name: "Knull" },
  { type: "controller", color: "#14b3b0", name: "Xerxes" },
];

export interface ProvidersQuickHubProps {
  instances: readonly InstanceInfo[];
  onOpenEngines: () => void;
}

function statusMeta(instance: InstanceInfo): { label: string; ready: boolean } {
  if (engineReady(instance)) {
    return { label: "Ready", ready: true };
  }
  if (instance.snapshot.state === "available" && instance.snapshot.authenticated === false) {
    return { label: "Sign-in required", ready: false };
  }
  return { label: "Needs setup", ready: false };
}

export function ProvidersQuickHub({ instances, onOpenEngines }: ProvidersQuickHubProps) {
  const readyCount = instances.filter(engineReady).length;

  return (
    <section
      id="grabbots-providers-hub"
      aria-labelledby="grabbots-providers-heading"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="grabbots-providers-heading" className="text-[17px] font-semibold tracking-[-0.01em] text-ink">
            Model Providers
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-secondary">
            {instances.length > 0
              ? `${readyCount} of ${instances.length} configured provider${instances.length === 1 ? "" : "s"} ready on this host.`
              : "Live provider readiness is read directly from your local host."}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenEngines}
          className="ui-button ui-button-pill gap-1.5"
        >
          <Cpu size={14} aria-hidden="true" />
          <span>Configure Providers</span>
        </button>
      </div>

      {instances.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-hairline/45 bg-card p-5">
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-ink">No providers detected yet</p>
            <p className="mt-1 text-[13px] text-ink-secondary">
              Connect Anthropic, OpenAI, Google, xAI, or a local model host in Settings.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenEngines}
            className="ui-button ui-button-primary ui-button-pill gap-1.5"
          >
            <span>Open AI Settings</span>
            <ArrowUpRight size={14} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {instances.map((instance, index) => {
            const status = statusMeta(instance);
            const companion = SQUAD_COMPANIONS[index % SQUAD_COMPANIONS.length]!;
            const email = instance.snapshot.authenticated === true ? instance.snapshot.account?.email : undefined;
            const subtitle = email ?? providerName(instance);

            return (
              <div
                key={instance.instanceId}
                data-grabbots-provider={instance.instanceId}
                className="flex flex-col justify-between gap-4 rounded-[22px] border border-hairline/45 bg-card p-4 transition-colors hover:border-hairline"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="relative flex size-11 shrink-0 items-center justify-center rounded-2xl border border-hairline/40 bg-panel">
                      <InstanceProviderMark instance={instance} size={24} />
                      <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border border-hairline/40 bg-card">
                        <InteractiveBotAvatar
                          type={companion.type}
                          color={companion.color}
                          name={companion.name}
                          size={14}
                          hoverActive={false}
                        />
                      </span>
                    </span>

                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold text-ink" title={instance.displayName}>
                        {instance.displayName}
                      </div>
                      <div className="truncate text-[12px] text-ink-secondary" title={subtitle}>
                        {subtitle}
                      </div>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                      status.ready ? "bg-success/10 text-success" : "bg-control text-ink-secondary",
                    )}
                  >
                    {status.ready ? (
                      <Check size={11} aria-hidden="true" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
                    )}
                    <span>{status.label}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-hairline/35 pt-3">
                  <span className="truncate text-[12px] text-ink-tertiary">
                    {instance.models.options.length > 0
                      ? `${instance.models.options.length} model${instance.models.options.length === 1 ? "" : "s"}`
                      : instance.models.default || "Default model"}
                  </span>

                  <button
                    type="button"
                    onClick={onOpenEngines}
                    className="ui-button ui-button-sm gap-1"
                  >
                    <span>{status.ready ? "Manage" : "Set up"}</span>
                    <ArrowUpRight size={13} aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
