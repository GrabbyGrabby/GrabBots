import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const androidWorkspaceDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(androidWorkspaceDir, "../..");
const distDir = path.join(repoRoot, "dist");
const capacitorProjectDir = path.join(androidWorkspaceDir, "android");
const localCapBin = path.join(
  androidWorkspaceDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "cap.cmd" : "cap",
);

function invokeSync(command, args, options) {
  const needsCmdWrapper = process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
  if (needsCmdWrapper) {
    const comspec = process.env.ComSpec ?? "cmd.exe";
    return spawnSync(comspec, ["/d", "/s", "/c", command, ...args], options);
  }
  return spawnSync(command, args, options);
}

function probeCommand(command, args) {
  const result = invokeSync(command, args, {
    cwd: androidWorkspaceDir,
    encoding: "utf8",
  });
  return {
    ok: !result.error && result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

function findAndroidSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.platform === "win32" && process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Android", "Sdk")
      : undefined,
    process.env.HOME ? path.join(process.env.HOME, "Android", "Sdk") : undefined,
    process.env.HOME ? path.join(process.env.HOME, "Library", "Android", "sdk") : undefined,
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function resolveCapacitorCommand() {
  if (existsSync(localCapBin)) {
    return { command: localCapBin, prefixArgs: [] };
  }
  const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
  const npxProbe = probeCommand(npxCommand, ["--no-install", "cap", "--version"]);
  if (npxProbe.ok) {
    return { command: npxCommand, prefixArgs: ["--no-install", "cap"] };
  }
  return null;
}

function runStep(command, args, cwd) {
  const result = invokeSync(command, args, {
    cwd,
    stdio: "inherit",
  });
  return !result.error && result.status === 0;
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const releaseBuild = process.argv.includes("--release");

  const hasWebDist = existsSync(path.join(distDir, "index.html"));
  const capCommand = resolveCapacitorCommand();
  const javaProbe = probeCommand("java", ["-version"]);
  const androidSdk = findAndroidSdk();
  const hasGradleProject = existsSync(capacitorProjectDir);

  console.log("=========================================================");
  console.log("   GrabBots · Android APK Build ($0 Capacitor / PWA)     ");
  console.log("=========================================================");
  console.log(`Web bundle (../../dist):  ${hasWebDist ? "ready" : "missing (run: pnpm build)"}`);
  console.log(`Capacitor CLI:            ${capCommand ? "installed" : "missing (run: pnpm install inside apps/android)"}`);
  console.log(`Java JDK:                 ${javaProbe.ok ? "detected" : "missing (install OpenJDK 17+)"}`);
  console.log(`Android SDK:              ${androidSdk ?? "missing (set ANDROID_HOME / install Android Studio)"}`);
  console.log(`Native Android project:   ${hasGradleProject ? capacitorProjectDir : "not initialized (runs: cap add android)"}`);

  const missing = [];
  if (!hasWebDist) missing.push("built web assets in ../../dist");
  if (!capCommand) missing.push("Capacitor CLI in apps/android/node_modules");
  if (!javaProbe.ok) missing.push("Java JDK 17+");
  if (!androidSdk) missing.push("Android SDK (ANDROID_HOME or ANDROID_SDK_ROOT)");

  if (missing.length > 0) {
    console.error("\n[GrabBots APK] Cannot build APK yet. Missing prerequisites:");
    for (const item of missing) {
      console.error(`  - ${item}`);
    }
    console.log("\nFree ($0) local APK setup instructions:");
    console.log("  1. Install OpenJDK 17+ and Android Studio (or Android Command-Line Tools) and set ANDROID_HOME.");
    console.log("  2. Build the web app from repo root: pnpm build");
    console.log("  3. Install Capacitor dependencies: cd apps/android && pnpm install");
    console.log("  4. Run from repo root: pnpm build:apk");
    console.log("\nNo-SDK alternative ($0): serve GrabBots and install the PWA via public/manifest.webmanifest.");
    process.exitCode = checkOnly ? 0 : 1;
    return;
  }

  if (checkOnly) {
    console.log("\n[GrabBots APK] All Android APK build prerequisites are satisfied.");
    return;
  }

  if (!hasGradleProject) {
    console.log("\n[GrabBots APK] Initializing Capacitor Android project...");
    if (!runStep(capCommand.command, [...capCommand.prefixArgs, "add", "android"], androidWorkspaceDir)) {
      process.exitCode = 1;
      return;
    }
  }

  console.log("\n[GrabBots APK] Syncing ../../dist into Capacitor Android project...");
  if (!runStep(capCommand.command, [...capCommand.prefixArgs, "sync", "android"], androidWorkspaceDir)) {
    process.exitCode = 1;
    return;
  }

  const gradlew = path.join(capacitorProjectDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");
  if (!existsSync(gradlew)) {
    console.error(`[GrabBots APK] Gradle wrapper not found at ${gradlew}`);
    process.exitCode = 1;
    return;
  }

  const gradleTask = releaseBuild ? "assembleRelease" : "assembleDebug";
  console.log(`\n[GrabBots APK] Building ${gradleTask}...`);
  if (!runStep(gradlew, [gradleTask], capacitorProjectDir)) {
    process.exitCode = 1;
    return;
  }

  const outputVariant = releaseBuild ? "release" : "debug";
  const outputName = releaseBuild ? "app-release-unsigned.apk" : "app-debug.apk";
  const apkPath = path.join(capacitorProjectDir, "app", "build", "outputs", "apk", outputVariant, outputName);
  console.log(`\n[GrabBots APK] Build finished. Expected output: ${apkPath}`);
}

main();
