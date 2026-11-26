import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, FileText, Folder, FolderOpen, MoreHorizontal, RefreshCw } from "lucide-react";
import type { CloudFilesBridge, CloudFilesDisk, CloudFilesState, FolderCheck, SharedFolder } from "../../electron/cloud-sync.mjs";
import { cn } from "@/lib/cn";
import { cloudFilesBridge, useCloudFiles } from "@/lib/cloud-files";
import { activeLocale, t } from "@/lib/i18n";
import type { LocaleKey } from "@/locales";
import { serverFetch } from "@/lib/relay-server";
import type { GrabBotsWorkspaceFilesPayload, WorkspaceFileEntry, WorkspaceFolderSummary, WorkspaceRootKey } from "@/features/grabbots";
import { useStore } from "@/state/store";
import { ConfirmDialog } from "./ConfirmDialog";
import { useCaptionChrome } from "./DesktopCapabilities";
import { Switch } from "./SettingsPrimitives";
import { MENU_SHEET } from "./menu-recipe";

const REFUSAL: Record<string, LocaleKey> = {
  "too-broad": "files.refusal.tooBroad", "app-data": "files.refusal.appData", "already-shared": "files.refusal.alreadyShared",
  "not-a-folder": "files.refusal.notAFolder", private: "files.refusal.private",
};
const SETTINGS = { type: "toggleAppSettings", open: true, section: "cloudAccount" } as const;
type Run = (action: () => Promise<CloudFilesState | void>) => Promise<void>;
type Ask = { kind: "share"; check: FolderCheck } | { kind: "stop"; folder: SharedFolder } | { kind: "suggest"; checks: FolderCheck[]; chosen: string[] };

const count = (value: number) => new Intl.NumberFormat(activeLocale()).format(value);
const formatBytes = (value: number) => {
  const power = value >= 1024 ** 3 ? 3 : value >= 1024 ** 2 ? 2 : 1;
  return `${new Intl.NumberFormat(activeLocale(), { maximumFractionDigits: power === 3 ? 1 : 0 }).format(value / 1024 ** power)} ${["", "KB", "MB", "GB"][power]}`;
};

export function folderSize(check: FolderCheck): string {
  const files = check.partial ? t("files.countMore", { count: count(check.files) })
    : check.files === 1 ? t("files.countOne") : t("files.count", { count: count(check.files) });
  return `${files} · ${formatBytes(check.bytes)}`;
}

export function refusalText(refusal: string, listed = false): string {
  return t(listed && refusal === "not-a-folder" ? "files.refusal.notAFolderListed" : REFUSAL[refusal] ?? "files.refusal.other");
}

/** A bot's change that met one of the person's is said for a week: theirs kept, the bot's beside it. */
const KEPT_SHOWN_MS = 7 * 24 * 60 * 60_000;

export function folderStatus(folder: SharedFolder, now = Date.now()): string {
  const kept = folder.kept?.[0];
  if (kept && now - kept.at < KEPT_SHOWN_MS && (folder.status === "synced" || folder.status === "copying")) return t("files.status.keptBoth", { file: kept.path, copy: kept.beside });
  if (folder.status === "copying") return t("files.status.copying", { done: count(folder.done), files: count(folder.files) });
  if (folder.status === "confirm-deletes") return t(folder.pendingDeletes === 1 ? "files.status.deletesOne" : "files.status.deletes", { count: count(folder.pendingDeletes) });
  if (folder.status === "problem") return folder.problem || t("files.status.problem");
  return t(folder.status === "waiting" ? "files.status.waiting" : folder.status === "missing" ? "files.status.missing" : "files.status.synced");
}

// Electron wraps what main threw: "Error invoking remote method 'files:share': Error: …". One line of it, no stack.
export function failureText(error: unknown): string {
  const message = (error instanceof Error ? error.message : String(error ?? "")).replace(/^Error invoking remote method '[^']*': (?:\w*Error: )?/, "");
  const line = message.split("\n")[0]!.trim();
  return line ? t("files.failedWith", { reason: line }) : t("files.failed");
}

/** Security: main decides every path; this page shows main's state and passes the person's choices (tokens, folder ids). */
export function FilesView() {
  const { dragProps } = useCaptionChrome();
  const bridge = cloudFilesBridge();
  return <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-app text-ink">
    <header {...dragProps} className="flex shrink-0 items-center gap-2.5 border-b border-hairline/40 px-6 py-4 max-md:pl-12">
      <FolderOpen size={18} className="text-ink-secondary" />
      <h1 className="text-[17px] font-semibold">{t("files.title")}</h1>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-6">
        {bridge ? <FilesPage bridge={bridge} /> : <HostWorkspaceFiles />}
      </div>
    </div>
  </main>;
}

const ROOT_TABS: ReadonlyArray<{ key: WorkspaceRootKey; gradient: string }> = [
  { key: "workspaces", gradient: "from-[#377FE6]/70 via-[#0EA5C6]/55 to-[#14B3B0]/65" },
  { key: "docs", gradient: "from-[#D96B43]/70 via-[#E87A54]/55 to-[#F2E3A7]/65" },
  { key: "skills", gradient: "from-[#8057C8]/70 via-[#4B7BEC]/55 to-[#14B3B0]/65" },
];

function formatHostSize(bytes: number): string {
  if (bytes <= 0) return "0 B";
  return formatBytes(bytes);
}

function HostWorkspaceFiles() {
  const { state } = useStore();
  const [payload, setPayload] = useState<GrabBotsWorkspaceFilesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ root: WorkspaceRootKey; path: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadFiles = useCallback(async (target: { root: WorkspaceRootKey; path: string } | null) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (target) {
        params.set("root", target.root);
        if (target.path) params.set("path", target.path);
      }
      const query = params.toString();
      const response = await serverFetch(`/api/grabbots/workspace-files${query ? `?${query}` : ""}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const next = (await response.json()) as GrabBotsWorkspaceFilesPayload;
      if (!controller.signal.aborted) setPayload(next);
    } catch (cause) {
      if (controller.signal.aborted || (cause instanceof Error && cause.name === "AbortError")) return;
      setError(cause instanceof Error ? cause.message : "Could not read host files.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFiles(selected);
    return () => abortRef.current?.abort();
  }, [loadFiles, selected]);

  const activeListing: WorkspaceFolderSummary | null = payload?.listing ?? null;

  const openEntry = (root: WorkspaceRootKey, entry: WorkspaceFileEntry) => {
    if (entry.kind !== "directory") return;
    setSelected({ root, path: entry.relativePath });
  };

  const stepBack = () => {
    if (!selected) return;
    const parts = selected.path.split("/").filter(Boolean);
    if (parts.length <= 1) {
      setSelected(null);
      return;
    }
    setSelected({ root: selected.root, path: parts.slice(0, -1).join("/") });
  };

  return (
    <div className="flex flex-col gap-6" data-host-workspace-files="">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-hairline/40 bg-card/85 px-5 py-4 backdrop-blur-md">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink">Host Files & Bot Folders</h2>
          <p className="mt-0.5 text-[12px] text-ink-secondary">
            {payload
              ? `${payload.activeBotIds.length} active squad bot${payload.activeBotIds.length === 1 ? "" : "s"} on this host. ${t("files.unavailable")}`
              : `${state.bots.length} active squad workspace${state.bots.length === 1 ? "" : "s"} on this host. ${t("files.unavailable")}`}
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void loadFiles(selected)}
          className="ui-button ui-button-sm gap-1.5"
        >
          <RefreshCw size={13} aria-hidden="true" className={cn(loading && "animate-spin")} />
          <span>{loading ? "Refreshing…" : "Refresh"}</span>
        </button>
      </div>

      {error && !payload && (
        <div role="status" className="rounded-2xl border border-hairline/45 bg-card p-4 text-[13px] text-ink-secondary">
          Host directory listing is unavailable right now ({error}).
        </div>
      )}

      {selected && activeListing ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={stepBack} className="ui-button ui-button-sm gap-1.5">
              <ArrowLeft size={13} aria-hidden="true" />
              <span>Back</span>
            </button>
            <span className="truncate font-mono text-[12px] text-ink-secondary">
              {activeListing.label}{selected.path ? ` / ${selected.path}` : ""}
            </span>
          </div>

          {activeListing.entries.length === 0 ? (
            <div className="rounded-2xl border border-hairline/45 bg-card p-5 text-[13px] text-ink-secondary">
              This directory is empty.
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {activeListing.entries.map((entry) => (
                <li key={entry.relativePath} className="relative flex flex-col pt-2.5">
                  <div
                    aria-hidden="true"
                    className="ml-3 h-3 w-20 rounded-t-xl border border-b-0 border-hairline/40 bg-gradient-to-r from-[#377FE6]/65 to-[#14B3B0]/65"
                  />
                  <button
                    type="button"
                    disabled={entry.kind !== "directory"}
                    onClick={() => openEntry(selected.root, entry)}
                    className={cn(
                      "flex items-center gap-3 rounded-[20px] rounded-tl-md border border-hairline/45 bg-card/90 p-4 text-left backdrop-blur-md transition-colors",
                      entry.kind === "directory" ? "hover:border-hairline hover:bg-raised" : "cursor-default",
                    )}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-hairline/35 bg-panel text-ink-secondary">
                      {entry.kind === "directory" ? <Folder size={17} aria-hidden="true" /> : <FileText size={17} aria-hidden="true" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium text-ink" title={entry.relativePath}>
                        {entry.name}
                      </div>
                      <div className="mt-0.5 text-[12px] text-ink-secondary">
                        {entry.kind === "directory"
                          ? `${entry.childCount ?? 0} item${entry.childCount === 1 ? "" : "s"}`
                          : formatHostSize(entry.sizeBytes)}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        payload && (
          <>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {ROOT_TABS.map(({ key, gradient }) => {
                const folder = payload.folders[key];
                return (
                  <li key={key} data-host-folder={key} className="relative flex flex-col pt-3">
                    <div
                      aria-hidden="true"
                      className={cn("ml-3 h-3.5 w-24 rounded-t-xl border border-b-0 border-hairline/40 bg-gradient-to-r", gradient)}
                    />
                    <button
                      type="button"
                      disabled={!folder.exists}
                      onClick={() => setSelected({ root: key, path: "" })}
                      className="flex flex-1 flex-col items-start gap-2.5 rounded-[22px] rounded-tl-md border border-hairline/45 bg-card/90 p-4 text-left backdrop-blur-md transition-colors hover:border-hairline hover:bg-raised disabled:opacity-60"
                    >
                      <span className="flex size-9 items-center justify-center rounded-xl border border-hairline/35 bg-panel text-ink-secondary">
                        <Folder size={17} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-semibold text-ink">{folder.label}</div>
                        <div className="mt-0.5 text-[12px] text-ink-secondary">
                          {folder.exists
                            ? `${folder.directoryCount} folder${folder.directoryCount === 1 ? "" : "s"} · ${folder.fileCount} file${folder.fileCount === 1 ? "" : "s"}`
                            : "Not created yet"}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            {payload.botWorkspaces.length > 0 && (
              <section className="flex flex-col gap-3">
                <h3 className="text-[14px] font-semibold text-ink">Bot Folders</h3>
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {payload.botWorkspaces.map((ws) => (
                    <li key={ws.botId} className="relative flex flex-col pt-3">
                      <div
                        aria-hidden="true"
                        className="ml-3 h-3.5 w-20 rounded-t-xl border border-b-0 border-hairline/40 bg-gradient-to-r from-[#D96B43]/70 to-[#4B7BEC]/70"
                      />
                      <button
                        type="button"
                        onClick={() => setSelected({ root: "workspaces", path: ws.relativePath })}
                        className="flex items-start gap-3 rounded-[22px] rounded-tl-md border border-hairline/45 bg-card/90 p-4 text-left backdrop-blur-md transition-colors hover:border-hairline hover:bg-raised"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-hairline/35 bg-panel text-ink-secondary">
                          <FolderOpen size={17} aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-medium text-ink">{ws.botId}</div>
                          <div className="mt-0.5 text-[12px] text-ink-secondary">
                            {ws.fileCount} file{ws.fileCount === 1 ? "" : "s"} · {formatHostSize(ws.totalBytes)}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )
      )}
    </div>
  );
}

function Unavailable() {
  const { state, dispatch } = useStore();
  return (
    <div className="relative overflow-hidden rounded-[26px] border border-hairline/40 bg-card p-6 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-3.5 w-20 rounded-t-lg bg-gradient-to-r from-[#E87A54]/70 to-[#4B7BEC]/70" aria-hidden="true" />
      </div>
      <div className="rounded-[20px] border border-hairline/40 bg-panel/80 p-5 backdrop-blur-md">
        <p className="text-[14px] leading-relaxed text-ink">{t("files.unavailable")}</p>
        <p className="mt-1.5 text-[12px] text-ink-secondary">
          {state.bots.length} active squad workspace{state.bots.length === 1 ? "" : "s"} managed locally on this host.
        </p>
        <button type="button" className="ui-button ui-button-pill mt-4" onClick={() => dispatch(SETTINGS)}>
          {t("files.openSettings")}
        </button>
      </div>
    </div>
  );
}

function FilesPage({ bridge }: { bridge: CloudFilesBridge }) {
  const { state: app, dispatch } = useStore();
  const [state, setState] = useCloudFiles(bridge);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const suggest = app.filesSuggest;
  const ready = state !== null && state.phase !== "unavailable";
  useEffect(() => {
    if (!ready || !suggest) return;
    let live = true;
    void bridge.checkFolders(suggest).then((checks) => {
      if (live && checks.length) setAsk({ kind: "suggest", checks, chosen: checks.filter((check) => !check.refusal).map((check) => check.token) });
    }).catch((error: unknown) => { if (live) setFailed(failureText(error)); });
    return () => { live = false; };
  }, [bridge, suggest, ready]);
  const run: Run = async (action) => {
    setBusy(true);
    setFailed(null);
    try { const next = await action(); if (next) setState(next); }
    catch (error) { setFailed(failureText(error)); }
    finally { setBusy(false); }
  };
  const close = () => setAsk(null);
  const share = (tokens: string[]) => { close(); void run(async () => { let next: CloudFilesState | undefined; for (const token of tokens) next = await bridge.share(token); return next; }); };
  const moreSpace = () => void run(() => bridge.moreSpace());
  if (!state) return null;
  if (state.phase === "unavailable") return <Unavailable />;
  return <>
    {(state.phase === "offline" || state.phase === "asleep") && <p role="status" data-files-phase={state.phase} className="rounded-xl bg-card px-4 py-3 text-[13px] text-ink-secondary">{t(state.phase === "asleep" ? "files.asleep" : "files.offline")}</p>}
    {state.phase === "signed-out" && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card px-4 py-3">
      <p className="text-[13px] text-ink">{t("files.signedOut")}</p>
      <button type="button" className="ui-button" onClick={() => dispatch(SETTINGS)}>{t("files.openSettings")}</button>
    </div>}
    {failed && <p role="alert" className="text-[13px] text-danger">{failed}</p>}
    <section aria-labelledby="files-shared" className="flex flex-col gap-3">
      <div>
        <h2 id="files-shared" className="text-[15px] font-medium text-ink">{t("files.shared.title")}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">{t("files.shared.help")}</p>
      </div>
      {state.shared.length > 0
        ? <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {state.shared.map((folder) => <FolderRow key={folder.id} folder={folder} bridge={bridge} busy={busy} run={run} onStop={() => setAsk({ kind: "stop", folder })} />)}
        </ul>
        : <p className="text-[13px] text-ink-secondary">{t("files.empty")}</p>}
      <button type="button" disabled={busy} className="ui-button self-start"
        onClick={() => void run(async () => { const check = await bridge.pickFolder(); if (check) setAsk({ kind: "share", check }); })}>{t("files.add")}</button>
      {state.disk && <Storage disk={state.disk} busy={busy} onMore={moreSpace} />}
    </section>
    <section aria-labelledby="files-outputs" className="flex flex-col gap-3">
      <h2 id="files-outputs" className="text-[15px] font-medium text-ink">{t("files.outputs.title")}</h2>
      <div className="flex flex-col items-start gap-3 rounded-xl bg-card p-4">
        <div className="flex w-full items-start justify-between gap-4">
          <div className="min-w-0">
            <p id="files-outputs-switch" className="text-[14px] text-ink">{t("files.outputs.switch")}</p>
            <p className="mt-1 text-[12px] text-ink-secondary">{t("files.outputs.help")}</p>
          </div>
          <Switch checked={state.outputs.enabled} disabled={busy} aria-labelledby="files-outputs-switch"
            onClick={() => void run(() => bridge.setOutputs(!state.outputs.enabled))} />
        </div>
        {state.outputs.problem && <p className="text-[12px] text-danger">{state.outputs.problem}</p>}
        {state.outputs.enabled && <button type="button" className="ui-button" onClick={() => void run(() => bridge.open({ outputs: true }))}>{t("files.outputs.open")}</button>}
      </div>
    </section>
    {ask?.kind === "share" && (ask.check.refusal
      ? <FilesDialog label={refusalText(ask.check.refusal)} onClose={close}
        actions={<button type="button" autoFocus className="ui-button ui-button-primary" onClick={close}>{t("files.ok")}</button>} />
      : <ConfirmDialog open tone="neutral" icon={<FolderOpen size={18} />} title={t("files.share.title", { name: ask.check.name })}
        body={t("files.share.body", { size: folderSize(ask.check) })} confirmLabel={t("files.share.confirm")}
        onCancel={close} onConfirm={() => share([ask.check.token])} />)}
    {ask?.kind === "stop" && <ConfirmDialog open title={t("files.stop.title", { name: ask.folder.name })} body={t("files.stop.body")}
      confirmLabel={t("files.stop")} onCancel={close} onConfirm={() => { close(); void run(() => bridge.stopSharing(ask.folder.id)); }} />}
    {ask?.kind === "suggest" && <FilesDialog label={t("files.suggest.title")} onClose={close} actions={<>
      <button type="button" autoFocus className="ui-button" onClick={close}>{t("files.cancel")}</button>
      <button type="button" disabled={!ask.chosen.length} className="ui-button ui-button-primary" onClick={() => share(ask.chosen)}>{t("files.share.confirm")}</button>
    </>}>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">{t("files.suggest.body")}</p>
      <ul className="mt-3 flex max-h-72 flex-col gap-1 overflow-y-auto">
        {ask.checks.map((check, index) => <li key={`${index}:${check.pcPath}`}>
          <label className={cn("flex items-start gap-3 rounded-lg px-2 py-2", check.refusal && "opacity-50")}>
            <input type="checkbox" className="mt-1" disabled={Boolean(check.refusal)} checked={!check.refusal && ask.chosen.includes(check.token)}
              onChange={(event) => setAsk({ ...ask, chosen: event.target.checked ? [...ask.chosen, check.token] : ask.chosen.filter((token) => token !== check.token) })} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[14px] text-ink" title={check.pcPath}>{check.name}</span>
              <span className="text-[12px] text-ink-secondary">{check.refusal ? refusalText(check.refusal, true) : folderSize(check)}</span>
            </span>
          </label>
        </li>)}
      </ul>
    </FilesDialog>}
  </>;
}

function FolderRow({ folder, bridge, busy, run, onStop }: { folder: SharedFolder; bridge: CloudFilesBridge; busy: boolean; run: Run; onStop: () => void }) {
  const button = (label: string, action: () => void, primary = false) =>
    <button type="button" disabled={busy} className={cn("ui-button ui-button-sm", primary && "ui-button-primary")} onClick={action}>{label}</button>;
  const actions = folder.status === "waiting" ? button(t("files.moreSpace"), () => void run(() => bridge.moreSpace()))
    : folder.status === "confirm-deletes" ? <>
      {button(t("files.deletes.remove"), () => void run(() => bridge.answerDeletes(folder.id, true)))}
      {button(t("files.deletes.keep"), () => void run(() => bridge.answerDeletes(folder.id, false)))}
    </>
    : folder.status === "missing" ? <>
      {button(t("files.locate"), () => void run(() => bridge.locate(folder.id)), true)}
      {button(t("files.stop"), onStop)}
    </> : null;
  return (
    <li data-files-folder={folder.status} className="group/folder relative flex flex-col pt-3">
      <div
        aria-hidden="true"
        className="ml-3 h-3.5 w-24 rounded-t-xl border border-b-0 border-hairline/40 bg-gradient-to-r from-[#D96B43]/70 via-[#4B7BEC]/55 to-[#14B3B0]/65"
      />
      <div className="relative overflow-hidden rounded-[22px] rounded-tl-md border border-hairline/45 bg-card/90 p-4 shadow-sm backdrop-blur-md transition-all hover:border-hairline/75 hover:shadow-md">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-hairline/35 bg-panel text-ink-secondary">
            <Folder size={17} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[14px] font-medium text-ink" title={folder.pcPath}>{folder.name}</span>
            <span className={cn("text-[12px]", folder.status === "problem" || folder.status === "missing" ? "text-danger" : "text-ink-secondary")}>{folderStatus(folder)}</span>
            {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
          </div>
          <FolderMenu name={folder.name} busy={busy} onOpen={() => void run(() => bridge.open({ folderId: folder.id }))} onStop={onStop} />
        </div>
      </div>
    </li>
  );
}

function FolderMenu({ name, busy, onOpen, onStop }: { name: string; busy: boolean; onOpen: () => void; onStop: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); } };
    const onDown = (event: PointerEvent) => { if (event.target instanceof Node && !ref.current?.contains(event.target)) setOpen(false); };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onDown);
    return () => { window.removeEventListener("keydown", onKey, true); window.removeEventListener("pointerdown", onDown); };
  }, [open]);
  const item = (label: string, action: () => void, danger = false) => <button type="button" role="menuitem" disabled={busy}
    className={cn("ui-menu-row w-full text-left", danger ? "text-danger" : "text-ink")} onClick={() => { setOpen(false); action(); }}>{label}</button>;
  return <div ref={ref} className="relative shrink-0">
    <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={t("files.more", { name })}
      className="ui-icon-button hover:bg-control hover:text-ink" onClick={() => setOpen((value) => !value)}><MoreHorizontal size={16} /></button>
    {open && <div role="menu" className={cn("absolute right-0 top-full z-40 mt-1 w-[220px] overflow-hidden text-[13px]", MENU_SHEET)}>
      {item(t("files.openHere"), onOpen)}
      {item(t("files.stop"), onStop, true)}
    </div>}
  </div>;
}

function Storage({ disk, busy, onMore }: { disk: CloudFilesDisk; busy: boolean; onMore: () => void }) {
  const percent = disk.totalBytes > 0 ? Math.min(100, Math.round((disk.usedBytes / disk.totalBytes) * 100)) : 0;
  return <div className="flex flex-col gap-1.5">
    <span className="text-[12px] text-ink-secondary">{t("files.storage", { used: formatBytes(disk.usedBytes), total: formatBytes(disk.totalBytes) })}</span>
    <div className="h-1 w-full overflow-hidden rounded-full bg-control" aria-hidden="true">
      <div className={cn("h-full rounded-full", disk.warn ? "bg-warning" : "bg-accent")} style={{ width: `${percent}%` }} />
    </div>
    {disk.warn && <div className="flex flex-wrap items-center gap-2">
      <span className="text-[12px] text-warning">{t("files.almostFull")}</span>
      <button type="button" disabled={busy} className="ui-button ui-button-sm" onClick={onMore}>{t("files.moreSpace")}</button>
    </div>}
  </div>;
}

function FilesDialog({ label, children, actions, onClose }: { label: string; children?: ReactNode; actions: ReactNode; onClose: () => void }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); close.current(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div role="dialog" aria-modal="true" aria-labelledby="files-dialog-label" className="w-full max-w-[440px] rounded-2xl border border-hairline/50 bg-panel p-5 shadow-2xl">
      <h2 id="files-dialog-label" className="text-[15px] font-semibold text-ink">{label}</h2>
      {children}
      <div className="mt-5 flex justify-end gap-2">{actions}</div>
    </div>
  </div>, document.body);
}
