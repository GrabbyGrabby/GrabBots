# GrabBots

**Local-first AI agent squad platform** — run a focused team of autonomous bots (**Zeus**, **Kraken**, **Knull**, **Xerxes**) directly on your machine with isolated workspaces, tool execution, BYO AI providers, and cross-platform web, desktop, and Android support.

## Features

- **Autonomous Squad Architecture**: Specialized agents (**Zeus**, **Kraken**, **Knull**, **Xerxes**) with persistent thread memory, shared context, routines, and group collaboration.
- **Interactive Open Bot Avatars**: Vector SVG avatars powered by `open-bot-avatar` with real-time cursor tracking and live state feedback (`bunny`, `egg`, `cat`, `controller`).
- **Bring Your Own AI**: Connect existing subscriptions or API keys (Claude, ChatGPT/Codex, Gemini, Grok, OpenRouter, Ollama, and local OpenAI-compatible endpoints).
- **Sandboxed Execution**: Built-in workspace isolation, CUA desktop/browser control, and human-in-the-loop approval gates.
- **Cross-Platform**: Web app, Windows (`.exe`), Linux (`.deb` / `.AppImage`), and Capacitor-packaged Android APK.

## Quick Start

```bash
pnpm install
node scripts/start-grabbots.mjs
```

- **Web UI**: `http://127.0.0.1:5199/`
- **Download Page**: `http://127.0.0.1:5199/download`
- **Pairing / Login**: `http://127.0.0.1:5199/pair`
- **Backend API**: `http://127.0.0.1:8799`

## Packaging

- **Windows installer**: `pnpm package:win`
- **Linux installer**: `pnpm package:linux`
- **Android APK (Capacitor)**: `pnpm build:apk`

## License

GrabBots is licensed under the [Apache License, Version 2.0](LICENSE). See [NOTICE](NOTICE) for third-party attributions.
