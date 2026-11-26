import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Download, Laptop, Monitor, RefreshCw, Smartphone, Terminal } from "lucide-react";

import { cn } from "@/lib/cn";
import { copyText } from "@/lib/copy-text";
import { serverFetch } from "@/lib/relay-server";
import type { GrabBotsDownloadsPayload, PlatformDownloadInfo } from "../types";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const power = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const scaled = bytes / 1024 ** power;
  return `${scaled >= 10 || power === 0 ? Math.round(scaled) : scaled.toFixed(1)} ${units[power]}`;
}

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const result = await copyText(command);
    if (result === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-hairline/40 bg-inset px-3 py-2">
      <code className="flex min-w-0 items-center gap-1.5 truncate font-mono text-[12px] text-ink">
        <Terminal size={12} aria-hidden="true" className="shrink-0 text-ink-tertiary" />
        <span className="truncate">{command}</span>
      </code>
      <button
        type="button"
        onClick={() => void handleCopy()}
        aria-label={`Copy ${command}`}
        className="ui-icon-button shrink-0"
      >
        {copied ? <Check size={14} className="text-success" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      </button>
    </div>
  );
}

function DesktopTargetCard({
  platform,
  icon: Icon,
  subtitle,
}: {
  platform: PlatformDownloadInfo;
  icon: typeof Laptop;
  subtitle: string;
}) {
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const handleCopyPath = async (path: string) => {
    const result = await copyText(path);
    if (result === "copied") {
      setCopiedPath(path);
      setTimeout(() => setCopiedPath((current) => (current === path ? null : current)), 1200);
    }
  };

  return (
    <div
      data-download-card={platform.id}
      className="flex flex-col justify-between gap-4 rounded-[22px] border border-hairline/45 bg-card p-5"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-hairline/40 bg-panel text-ink">
              <Icon size={18} aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-[15px] font-semibold text-ink">{platform.label}</h3>
              <p className="text-[12px] text-ink-secondary">{subtitle}</p>
            </div>
          </div>

          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium",
              platform.available ? "bg-success/10 text-success" : "bg-control text-ink-secondary",
            )}
          >
            {platform.available ? "Ready on disk" : "Build locally"}
          </span>
        </div>

        <p className="mt-3 text-[12px] leading-relaxed text-ink-secondary">{platform.notes}</p>
      </div>

      {platform.available && platform.artifacts.length > 0 ? (
        <div className="flex flex-col gap-2">
          {platform.artifacts.slice(0, 2).map((artifact) => (
            <div
              key={artifact.relativePath}
              className="flex items-center justify-between gap-2 rounded-xl border border-hairline/40 bg-panel px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-ink" title={artifact.relativePath}>
                  {artifact.fileName}
                </div>
                <div className="text-[11px] text-ink-tertiary">
                  {formatSize(artifact.sizeBytes)} · {artifact.relativePath}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleCopyPath(artifact.relativePath)}
                className="ui-button ui-button-sm ui-button-primary shrink-0 gap-1"
              >
                {copiedPath === artifact.relativePath ? (
                  <>
                    <Check size={12} aria-hidden="true" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Download size={12} aria-hidden="true" />
                    <span>Copy path</span>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <CopyCommand command={platform.buildCommand} />
      )}
    </div>
  );
}

function PhoneDownloadCard({
  android,
  pwa,
  installPrompt,
  onInstallPwa,
  pwaStatus,
}: {
  android: PlatformDownloadInfo;
  pwa: PlatformDownloadInfo;
  installPrompt: BeforeInstallPromptEvent | null;
  onInstallPwa: () => void;
  pwaStatus: string | null;
}) {
  return (
    <div
      data-download-card="phone"
      className="flex flex-col justify-between gap-4 rounded-[22px] border border-hairline/45 bg-card p-5"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-hairline/40 bg-panel text-ink">
              <Smartphone size={18} aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-[15px] font-semibold text-ink">Phone (Android & Web)</h3>
              <p className="text-[12px] text-ink-secondary">{android.cost} APK + Web PWA</p>
            </div>
          </div>

          <span className="inline-flex shrink-0 items-center rounded-full bg-success/10 px-2.5 py-0.5 text-[11px] font-medium text-success">
            {android.cost}
          </span>
        </div>

        <p className="mt-3 text-[12px] leading-relaxed text-ink-secondary">{android.notes}</p>
      </div>

      <div className="flex flex-col gap-2.5">
        {android.available && android.artifacts.length > 0 ? (
          android.artifacts.slice(0, 1).map((artifact) => (
            <div
              key={artifact.relativePath}
              className="flex items-center justify-between gap-2 rounded-xl border border-hairline/40 bg-panel px-3 py-2 text-[12px]"
            >
              <span className="truncate font-medium text-ink" title={artifact.relativePath}>
                {artifact.fileName} ({formatSize(artifact.sizeBytes)})
              </span>
              <span className="shrink-0 text-success">APK ready</span>
            </div>
          ))
        ) : (
          <CopyCommand command={android.buildCommand} />
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-hairline/40 bg-panel px-3 py-2">
          <div className="min-w-0">
            <div className="text-[12px] font-medium text-ink">
              {pwa.manifest?.name ?? "GrabBots"} Web App
            </div>
            <div className="text-[11px] text-ink-tertiary">
              {pwaStatus ?? (pwa.available ? "Ready to install from browser" : pwa.notes)}
            </div>
          </div>
          <button
            type="button"
            disabled={!pwa.available}
            onClick={onInstallPwa}
            className="ui-button ui-button-sm ui-button-primary shrink-0 gap-1"
          >
            <Download size={12} aria-hidden="true" />
            <span>{installPrompt ? "Install PWA" : "Web App"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function DownloadsHub() {
  const [data, setData] = useState<GrabBotsDownloadsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [pwaStatus, setPwaStatus] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadDownloads = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const response = await serverFetch("/api/grabbots/downloads", { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = (await response.json()) as GrabBotsDownloadsPayload;
      if (!controller.signal.aborted) setData(payload);
    } catch (cause) {
      if (controller.signal.aborted || (cause instanceof Error && cause.name === "AbortError")) return;
      setError(cause instanceof Error ? cause.message : "Could not check download artifacts.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDownloads();
    return () => abortRef.current?.abort();
  }, [loadDownloads]);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const handleInstallPwa = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setPwaStatus(choice.outcome === "accepted" ? "Installed as web app." : "Install dismissed.");
      setInstallPrompt(null);
      return;
    }
    setPwaStatus("Open browser menu and choose Install GrabBots.");
  };

  return (
    <section aria-labelledby="grabbots-downloads-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="grabbots-downloads-heading" className="text-[17px] font-semibold tracking-[-0.01em] text-ink">
            Downloads & Apps
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-secondary">
            {data
              ? `GrabBots v${data.version} installers and local build targets on this host.`
              : "Checking local installers and Android/PWA targets."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadDownloads()}
          disabled={loading}
          className="ui-button ui-button-pill gap-1.5"
        >
          <RefreshCw size={13} aria-hidden="true" className={cn(loading && "animate-spin")} />
          <span>{loading ? "Checking…" : "Refresh"}</span>
        </button>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] text-danger">
          <span>Could not load download status: {error}</span>
          <button type="button" onClick={() => void loadDownloads()} className="ui-button ui-button-sm">
            Try again
          </button>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <DesktopTargetCard
            platform={data.platforms.windows}
            icon={Monitor}
            subtitle="NSIS installer (.exe)"
          />
          <DesktopTargetCard
            platform={data.platforms.linux}
            icon={Laptop}
            subtitle="AppImage & Debian (.AppImage, .deb)"
          />
          <PhoneDownloadCard
            android={data.platforms.android}
            pwa={data.platforms.pwa}
            installPrompt={installPrompt}
            onInstallPwa={() => void handleInstallPwa()}
            pwaStatus={pwaStatus}
          />
        </div>
      )}
    </section>
  );
}
