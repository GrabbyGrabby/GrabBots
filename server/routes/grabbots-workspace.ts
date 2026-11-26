import { createReadStream, existsSync, lstatSync, readdirSync, realpathSync, statSync, type Dirent } from "node:fs";
import { basename, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getGrabBotsDownloads } from "../grabbots-downloads.ts";
import type { Store } from "../store.ts";
import { PASS, type RouteHandler } from "./table.ts";

export type WorkspaceRootKey = "workspaces" | "docs" | "skills";

export interface WorkspaceFileEntry {
  name: string;
  relativePath: string;
  kind: "file" | "directory";
  sizeBytes: number;
  modifiedAt: string;
  extension: string | null;
  childCount?: number;
}

export interface WorkspaceFolderSummary {
  root: WorkspaceRootKey;
  label: string;
  exists: boolean;
  totalEntries: number;
  fileCount: number;
  directoryCount: number;
  totalBytes: number;
  truncated: boolean;
  entries: WorkspaceFileEntry[];
}

export interface BotWorkspaceSummary {
  botId: string;
  relativePath: string;
  fileCount: number;
  totalBytes: number;
  modifiedAt: string;
  entries: WorkspaceFileEntry[];
}

export interface GrabBotsWorkspaceFilesPayload {
  product: "GrabBots";
  collectedAt: number;
  requestedRoot: WorkspaceRootKey | null;
  requestedPath: string | null;
  activeBotIds: string[];
  botWorkspaces: BotWorkspaceSummary[];
  folders: {
    workspaces: WorkspaceFolderSummary;
    docs: WorkspaceFolderSummary;
    skills: WorkspaceFolderSummary;
  };
  listing?: WorkspaceFolderSummary;
}

export interface GrabBotsWorkspaceDeps {
  store?: Pick<Store, "bots">;
  dataDir?: string;
  repoRoot?: string;
}

const VALID_ROOTS: readonly WorkspaceRootKey[] = ["workspaces", "docs", "skills"];
const MAX_ENTRIES_PER_FOLDER = 120;
const SKIP_DIR_NAMES = new Set(["node_modules"]);

const ROOT_LABELS: Record<WorkspaceRootKey, string> = {
  workspaces: "Bot Workspaces",
  docs: "Workspace Docs",
  skills: "Skills Library",
};

function defaultRepoRoot(): string {
  const fromModule = fileURLToPath(new URL("../..", import.meta.url));
  if (existsSync(join(fromModule, "package.json"))) return fromModule;
  const parent = resolve(fromModule, "..");
  if (existsSync(join(parent, "package.json"))) return parent;
  return process.cwd();
}

function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
}

function resolveDataDir(repoRoot: string, explicitDataDir?: string): string {
  if (explicitDataDir) return resolve(explicitDataDir);
  if (process.env.GRABBOTS_DATA_DIR) return resolve(process.env.GRABBOTS_DATA_DIR);
  if (process.env.OMB_DATA_DIR) return resolve(process.env.OMB_DATA_DIR);
  return join(repoRoot, ".grabbots-data");
}

function isWorkspaceRoot(value: string): value is WorkspaceRootKey {
  return (VALID_ROOTS as readonly string[]).includes(value);
}

function isInsideRealRoot(realRoot: string, targetPath: string): boolean {
  let targetReal: string;
  try {
    targetReal = realpathSync(targetPath);
  } catch {
    return false;
  }
  const rel = relative(realRoot, targetReal);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function resolveSafeSubpath(
  rootDir: string,
  subpath: string,
): { ok: true; targetDir: string; normalizedPath: string; rootMissing: boolean } | { ok: false; status: 400 | 404; error: string } {
  const trimmed = subpath.trim();
  if (trimmed.includes("\0") || isAbsolute(trimmed) || /^[a-zA-Z]:/.test(trimmed)) {
    return { ok: false, status: 400, error: "Invalid workspace path" };
  }

  const normalized = toPosixPath(trimmed).replace(/^\/+|\/+$/g, "");
  const segments = normalized ? normalized.split("/") : [];
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return { ok: false, status: 400, error: "Invalid workspace path" };
  }

  if (!existsSync(rootDir)) {
    if (segments.length === 0) {
      return { ok: true, targetDir: rootDir, normalizedPath: "", rootMissing: true };
    }
    return { ok: false, status: 404, error: "Workspace directory not found" };
  }

  const realRoot = realpathSync(rootDir);
  const candidate = segments.length === 0 ? rootDir : resolve(rootDir, ...segments);
  const lexicalRel = relative(resolve(rootDir), candidate);
  if (lexicalRel.startsWith("..") || isAbsolute(lexicalRel)) {
    return { ok: false, status: 400, error: "Invalid workspace path" };
  }

  if (!existsSync(candidate)) {
    return { ok: false, status: 404, error: "Workspace directory not found" };
  }

  if (!isInsideRealRoot(realRoot, candidate)) {
    return { ok: false, status: 400, error: "Invalid workspace path" };
  }

  try {
    if (!statSync(candidate).isDirectory()) {
      return { ok: false, status: 404, error: "Workspace directory not found" };
    }
  } catch {
    return { ok: false, status: 404, error: "Workspace directory not found" };
  }

  return { ok: true, targetDir: candidate, normalizedPath: normalized, rootMissing: false };
}

function scanDirectory(
  root: WorkspaceRootKey,
  rootDir: string,
  scanDir: string,
  maxDepth: number,
  maxEntries: number,
): WorkspaceFolderSummary {
  const label = ROOT_LABELS[root];
  if (!existsSync(rootDir) || !existsSync(scanDir)) {
    return {
      root,
      label,
      exists: false,
      totalEntries: 0,
      fileCount: 0,
      directoryCount: 0,
      totalBytes: 0,
      truncated: false,
      entries: [],
    };
  }

  const realRoot = realpathSync(rootDir);
  if (!isInsideRealRoot(realRoot, scanDir)) {
    return {
      root,
      label,
      exists: false,
      totalEntries: 0,
      fileCount: 0,
      directoryCount: 0,
      totalBytes: 0,
      truncated: false,
      entries: [],
    };
  }

  const entries: WorkspaceFileEntry[] = [];
  let fileCount = 0;
  let directoryCount = 0;
  let totalBytes = 0;
  let truncated = false;

  const visit = (dir: string, depth: number): void => {
    if (depth > maxDepth) return;
    let children;
    try {
      children = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return;
    }

    for (const child of children) {
      if (child.name.startsWith(".")) continue;
      if (child.isDirectory() && SKIP_DIR_NAMES.has(child.name)) continue;

      const fullPath = join(dir, child.name);
      if (!isInsideRealRoot(realRoot, fullPath)) continue;

      let lstat;
      let stats;
      try {
        lstat = lstatSync(fullPath);
        stats = statSync(fullPath);
      } catch {
        continue;
      }

      if (lstat.isSymbolicLink() && !isInsideRealRoot(realRoot, fullPath)) continue;

      const isDir = stats.isDirectory();
      const relPath = toPosixPath(relative(realRoot, realpathSync(fullPath)));
      if (!relPath || relPath.startsWith("..")) continue;

      if (entries.length >= maxEntries) {
        truncated = true;
        return;
      }

      if (isDir) {
        directoryCount += 1;
        let childCount = 0;
        try {
          childCount = readdirSync(fullPath).filter((name) => !name.startsWith(".")).length;
        } catch {
          childCount = 0;
        }
        entries.push({
          name: child.name,
          relativePath: relPath,
          kind: "directory",
          sizeBytes: 0,
          modifiedAt: stats.mtime.toISOString(),
          extension: null,
          childCount,
        });
        if (depth < maxDepth) visit(fullPath, depth + 1);
      } else if (stats.isFile()) {
        fileCount += 1;
        totalBytes += stats.size;
        const ext = extname(child.name);
        entries.push({
          name: child.name,
          relativePath: relPath,
          kind: "file",
          sizeBytes: stats.size,
          modifiedAt: stats.mtime.toISOString(),
          extension: ext || null,
        });
      }
    }
  };

  visit(scanDir, 0);

  return {
    root,
    label,
    exists: true,
    totalEntries: entries.length,
    fileCount,
    directoryCount,
    totalBytes,
    truncated,
    entries,
  };
}

function collectBotWorkspaces(
  workspacesDir: string,
  store?: Pick<Store, "bots">,
): { activeBotIds: string[]; botWorkspaces: BotWorkspaceSummary[] } {
  const botIdSet = new Set<string>();
  if (store) {
    for (const bot of store.bots) {
      if (!bot.hidden && bot.id) botIdSet.add(bot.id);
    }
  }

  const botWorkspaces: BotWorkspaceSummary[] = [];
  if (existsSync(workspacesDir)) {
    const realRoot = realpathSync(workspacesDir);
    let children: Dirent[] = [];
    try {
      children = readdirSync(workspacesDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      children = [];
    }
    for (const child of children) {
      if (child.name.startsWith(".") || !child.isDirectory()) continue;
      const botDir = join(workspacesDir, child.name);
      if (!isInsideRealRoot(realRoot, botDir)) continue;
      botIdSet.add(child.name);
      const summary = scanDirectory("workspaces", workspacesDir, botDir, 1, 40);
      let modifiedAt = new Date(0).toISOString();
      try {
        modifiedAt = statSync(botDir).mtime.toISOString();
      } catch {
        // Keep epoch fallback if stat fails.
      }
      botWorkspaces.push({
        botId: child.name,
        relativePath: child.name,
        fileCount: summary.fileCount,
        totalBytes: summary.totalBytes,
        modifiedAt,
        entries: summary.entries,
      });
    }
  }

  return {
    activeBotIds: Array.from(botIdSet).sort((a, b) => a.localeCompare(b)),
    botWorkspaces,
  };
}

/**
 * Isolated route handler serving `/api/grabbots/downloads` and `/api/grabbots/workspace-files`.
 */
export function createGrabBotsWorkspaceRoutes(deps: GrabBotsWorkspaceDeps = {}): RouteHandler {
  return async ({ res, url, path, method, json }) => {
    const repoRoot = resolve(deps.repoRoot ?? defaultRepoRoot());

    if (method === "GET" && path === "/api/grabbots/downloads") {
      res.setHeader("cache-control", "no-store");
      return json(res, 200, getGrabBotsDownloads({ repoRoot }));
    }

    if (method === "GET" && path === "/api/grabbots/workspace-files") {
      res.setHeader("cache-control", "no-store");
      const rawRoot = url.searchParams.get("root");
      const rawPath = url.searchParams.get("path");

      if (rawPath !== null && rawPath.trim() !== "" && rawRoot === null) {
        return json(res, 400, { error: "Workspace root is required when path is specified" });
      }

      let requestedRoot: WorkspaceRootKey | null = null;
      if (rawRoot !== null && rawRoot.trim() !== "") {
        const trimmedRoot = rawRoot.trim();
        if (!isWorkspaceRoot(trimmedRoot)) {
          return json(res, 400, { error: "Invalid workspace root" });
        }
        requestedRoot = trimmedRoot;
      }

      const dataDir = resolveDataDir(repoRoot, deps.dataDir);
      const rootDirs: Record<WorkspaceRootKey, string> = {
        workspaces: join(dataDir, "workspaces"),
        docs: join(repoRoot, "docs"),
        skills: join(repoRoot, "skills"),
      };

      let listing: WorkspaceFolderSummary | undefined;
      let requestedPath: string | null = null;
      if (requestedRoot) {
        const safe = resolveSafeSubpath(rootDirs[requestedRoot], rawPath ?? "");
        if (!safe.ok) {
          return json(res, safe.status, { error: safe.error });
        }
        requestedPath = safe.normalizedPath || null;
        listing = safe.rootMissing
          ? scanDirectory(requestedRoot, rootDirs[requestedRoot], rootDirs[requestedRoot], 1, MAX_ENTRIES_PER_FOLDER)
          : scanDirectory(requestedRoot, rootDirs[requestedRoot], safe.targetDir, 1, MAX_ENTRIES_PER_FOLDER);
      }

      const folders = {
        workspaces: scanDirectory("workspaces", rootDirs.workspaces, rootDirs.workspaces, 1, MAX_ENTRIES_PER_FOLDER),
        docs: scanDirectory("docs", rootDirs.docs, rootDirs.docs, 1, MAX_ENTRIES_PER_FOLDER),
        skills: scanDirectory("skills", rootDirs.skills, rootDirs.skills, 1, MAX_ENTRIES_PER_FOLDER),
      };

      const { activeBotIds, botWorkspaces } = collectBotWorkspaces(rootDirs.workspaces, deps.store);

      const payload: GrabBotsWorkspaceFilesPayload = {
        product: "GrabBots",
        collectedAt: Date.now(),
        requestedRoot,
        requestedPath,
        activeBotIds,
        botWorkspaces,
        folders,
        ...(listing ? { listing } : {}),
      };

      return json(res, 200, payload);
    }

    if (method === "GET" && pathname.startsWith("/api/grabbots/downloads/file/")) {
      const requested = decodeURIComponent(pathname.slice("/api/grabbots/downloads/file/".length));
      const fileName = basename(requested);
      if (!fileName || fileName !== requested || fileName.includes("..")) {
        return json(res, 400, { error: "Invalid file name" });
      }
      const releaseDir = join(repoRoot, "release");
      const filePath = join(releaseDir, fileName);
      if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        return json(res, 404, { error: "Release artifact not found" });
      }
      const stat = statSync(filePath);
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(stat.size),
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      });
      createReadStream(filePath).pipe(res);
      return;
    }

    return PASS;
  };
}
