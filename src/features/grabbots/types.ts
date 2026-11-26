export interface DownloadArtifact {
  fileName: string;
  relativePath: string;
  extension: string;
  sizeBytes: number;
  modifiedAt: string;
}

export interface WebPwaManifestSummary {
  name: string;
  shortName: string;
  startUrl: string;
  display: string;
  iconsReady: boolean;
}

export interface PlatformDownloadInfo {
  id: "windows" | "linux" | "macos" | "android" | "pwa";
  label: string;
  available: boolean;
  cost: string;
  costNote: string;
  buildCommand: string;
  extensions: string[];
  artifacts: DownloadArtifact[];
  scaffolded?: boolean;
  manifestPath?: string | null;
  manifest?: WebPwaManifestSummary | null;
  notes: string;
}

export interface GrabBotsDownloadsPayload {
  product: "GrabBots";
  version: string;
  checkedAt: number;
  releaseDirExists: boolean;
  platforms: {
    windows: PlatformDownloadInfo;
    linux: PlatformDownloadInfo;
    macos: PlatformDownloadInfo;
    android: PlatformDownloadInfo;
    pwa: PlatformDownloadInfo;
  };
}

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
