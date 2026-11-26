import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

export interface GrabBotsDownloadsOptions {
  repoRoot?: string;
}

function defaultRepoRoot(): string {
  const fromModule = fileURLToPath(new URL("..", import.meta.url));
  if (existsSync(join(fromModule, "package.json"))) return fromModule;
  const parent = resolve(fromModule, "..");
  if (existsSync(join(parent, "package.json"))) return parent;
  return process.cwd();
}

function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
}

function readPackageVersion(repoRoot: string): string {
  const pkgPath = join(repoRoot, "package.json");
  if (!existsSync(pkgPath)) return "0.0.0";
  try {
    const parsed = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: unknown };
    return typeof parsed.version === "string" && parsed.version.trim() ? parsed.version.trim() : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function collectArtifacts(
  baseDir: string,
  repoRoot: string,
  allowedExtensions: readonly string[],
  maxDepth: number,
  skipDirs: ReadonlySet<string>,
): DownloadArtifact[] {
  if (!existsSync(baseDir)) return [];
  const allowed = new Set(allowedExtensions.map((ext) => ext.toLowerCase()));
  const artifacts: DownloadArtifact[] = [];

  const walk = (dir: string, depth: number): void => {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name) || entry.name.endsWith("-unpacked")) continue;
        walk(fullPath, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = extname(entry.name);
      if (!allowed.has(ext.toLowerCase())) continue;
      try {
        const stats = statSync(fullPath);
        artifacts.push({
          fileName: entry.name,
          relativePath: toPosixPath(relative(repoRoot, fullPath)),
          extension: ext,
          sizeBytes: stats.size,
          modifiedAt: stats.mtime.toISOString(),
        });
      } catch {
        // Ignore files that disappear during scan.
      }
    }
  };

  walk(baseDir, 0);
  return artifacts.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function inspectWebManifest(repoRoot: string): {
  manifestPath: string | null;
  available: boolean;
  manifest: WebPwaManifestSummary | null;
} {
  const manifestFile = join(repoRoot, "public", "manifest.webmanifest");
  if (!existsSync(manifestFile)) {
    return { manifestPath: null, available: false, manifest: null };
  }
  try {
    const raw = JSON.parse(readFileSync(manifestFile, "utf8")) as {
      name?: unknown;
      short_name?: unknown;
      start_url?: unknown;
      display?: unknown;
      icons?: Array<{ src?: unknown }>;
    };
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    const shortName = typeof raw.short_name === "string" ? raw.short_name.trim() : name;
    const startUrl = typeof raw.start_url === "string" ? raw.start_url.trim() : "/";
    const display = typeof raw.display === "string" ? raw.display.trim() : "standalone";
    const icons = Array.isArray(raw.icons) ? raw.icons : [];
    const iconsReady =
      icons.length > 0 &&
      icons.every((icon) => {
        if (typeof icon?.src !== "string") return false;
        const cleanSrc = icon.src.replace(/^\/+/, "");
        return cleanSrc.length > 0 && !cleanSrc.includes("..") && existsSync(join(repoRoot, "public", cleanSrc));
      });
    const available = name.length > 0 && startUrl.length > 0;
    return {
      manifestPath: "public/manifest.webmanifest",
      available,
      manifest: available
        ? { name, shortName, startUrl, display, iconsReady }
        : null,
    };
  } catch {
    return { manifestPath: "public/manifest.webmanifest", available: false, manifest: null };
  }
}

/**
 * Inspects local build artifacts (`release/`, `apps/android/`, `public/manifest.webmanifest`)
 * and returns honest platform availability without mocked URLs or counters.
 */
export function getGrabBotsDownloads(options: GrabBotsDownloadsOptions = {}): GrabBotsDownloadsPayload {
  const repoRoot = resolve(options.repoRoot ?? defaultRepoRoot());
  const releaseDir = join(repoRoot, "release");
  const androidDir = join(repoRoot, "apps", "android");
  const releaseDirExists = existsSync(releaseDir);

  const releaseSkip = new Set(["node_modules", "mac", "mac-arm64", "linux-unpacked", "win-unpacked"]);
  const androidSkip = new Set(["node_modules", ".gradle", "build-cache"]);

  const winArtifacts = collectArtifacts(releaseDir, repoRoot, [".exe"], 2, releaseSkip);
  const linuxArtifacts = collectArtifacts(releaseDir, repoRoot, [".AppImage", ".deb"], 2, releaseSkip);
  const macArtifacts = collectArtifacts(releaseDir, repoRoot, [".dmg"], 2, releaseSkip);
  const androidArtifacts = [
    ...collectArtifacts(androidDir, repoRoot, [".apk"], 6, androidSkip),
    ...collectArtifacts(releaseDir, repoRoot, [".apk"], 2, releaseSkip),
  ];

  const androidScaffolded =
    existsSync(join(androidDir, "build-apk.mjs")) ||
    existsSync(join(androidDir, "capacitor.config.json"));

  const pwaInfo = inspectWebManifest(repoRoot);

  return {
    product: "GrabBots",
    version: readPackageVersion(repoRoot),
    checkedAt: Date.now(),
    releaseDirExists,
    platforms: {
      windows: {
        id: "windows",
        label: "Windows",
        available: winArtifacts.length > 0,
        cost: "Free (open source)",
        costNote: "Built locally via electron-builder NSIS target.",
        buildCommand: "pnpm package:win",
        extensions: [".exe"],
        artifacts: winArtifacts,
        notes:
          winArtifacts.length > 0
            ? `Found ${winArtifacts.length} Windows installer artifact(s) in release/.`
            : "No .exe installer found in release/. Run pnpm package:win to build locally.",
      },
      linux: {
        id: "linux",
        label: "Linux",
        available: linuxArtifacts.length > 0,
        cost: "Free (open source)",
        costNote: "Built locally via electron-builder AppImage and deb targets.",
        buildCommand: "pnpm package:linux",
        extensions: [".AppImage", ".deb"],
        artifacts: linuxArtifacts,
        notes:
          linuxArtifacts.length > 0
            ? `Found ${linuxArtifacts.length} Linux package artifact(s) in release/.`
            : "No .AppImage or .deb package found in release/. Run pnpm package:linux to build locally.",
      },
      macos: {
        id: "macos",
        label: "macOS",
        available: macArtifacts.length > 0,
        cost: "Free (open source)",
        costNote: "Built locally on macOS via electron-builder dmg target.",
        buildCommand: "pnpm package:mac",
        extensions: [".dmg"],
        artifacts: macArtifacts,
        notes:
          macArtifacts.length > 0
            ? `Found ${macArtifacts.length} macOS disk image(s) in release/.`
            : "No .dmg disk image found in release/. Run pnpm package:mac on macOS to build locally.",
      },
      android: {
        id: "android",
        label: "Android APK",
        available: androidArtifacts.length > 0,
        cost: "$0",
        costNote: "$0 free Capacitor/PWA Android APK build via local Android SDK and Gradle (no store fees).",
        buildCommand: "pnpm build:apk",
        extensions: [".apk"],
        artifacts: androidArtifacts,
        scaffolded: androidScaffolded,
        notes:
          androidArtifacts.length > 0
            ? `Found ${androidArtifacts.length} Android APK artifact(s) on disk.`
            : androidScaffolded
              ? "Android Capacitor project scaffolded at apps/android/. Run pnpm build:apk with Android SDK/Gradle to generate an APK ($0)."
              : "Android APK project not yet scaffolded under apps/android/.",
      },
      pwa: {
        id: "pwa",
        label: "Web PWA",
        available: pwaInfo.available,
        cost: "$0",
        costNote: "$0 instant browser install via web app manifest (no app store fees).",
        buildCommand: "pnpm build",
        extensions: [".webmanifest"],
        artifacts: [],
        manifestPath: pwaInfo.manifestPath,
        manifest: pwaInfo.manifest,
        notes: pwaInfo.available
          ? "Web app manifest ready for direct browser install on desktop and mobile."
          : "Web app manifest is missing or incomplete at public/manifest.webmanifest.",
      },
    },
  };
}
