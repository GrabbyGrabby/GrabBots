# GrabBots Android APK (`$0` Capacitor + PWA)

This workspace packages the built GrabBots web app (`../../dist`) as a free (`$0`) Android APK using [Capacitor](https://capacitorjs.com/) (`com.grabbots.app` / `GrabBots`), with zero paid SDK licenses or Play Store fees required for local sideloading.

## Configuration

- **App ID:** `com.grabbots.app`
- **App Name:** `GrabBots`
- **Web Bundle Directory:** `../../dist` (defined in `capacitor.config.json`)

## Prerequisites (`$0` Open-Source Tooling)

1. **Node.js `>=24`** and **pnpm**
2. **Java JDK 17+** (e.g., Eclipse Temurin)
3. **Android SDK** (via Android Studio or Android Command-Line Tools) with `ANDROID_HOME` (or `ANDROID_SDK_ROOT`) configured

## Build Steps

From the repository root:

```bash
pnpm build
cd apps/android && pnpm install
cd ../..
pnpm build:apk
```

When all prerequisites are installed, `pnpm build:apk` initializes `apps/android/android/` (if missing), runs `cap sync android`, and compiles the APK via Gradle (`assembleDebug`, or pass `-- --release` for `assembleRelease`).

Expected debug APK output:

```text
apps/android/android/app/build/outputs/apk/debug/app-debug.apk
```

To inspect environment readiness without failing the exit code:

```bash
node apps/android/build-apk.mjs --check
```

## Zero-SDK Option (`$0` Web PWA)

If you do not want to install Android Studio or the Android SDK, GrabBots ships `public/manifest.webmanifest` so you can install it directly as a Progressive Web App on Android Chrome for `$0`.
