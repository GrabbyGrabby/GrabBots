import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

console.log("=========================================================");
console.log("   GrabBots · Autonomous Squad                           ");
console.log("=========================================================");
console.log(`Workspace root: ${rootDir}`);

const sharedEnv = {
  ...process.env,
  OMB_DATA_DIR: process.env.OMB_DATA_DIR ?? path.join(rootDir, ".grabbots-data"),
  OMB_PORT: process.env.OMB_PORT ?? "8799",
  OMB_UI_PORT: process.env.OMB_UI_PORT ?? "5199",
  OMB_DEV_TRUST_LOCAL_BROWSER: process.env.OMB_DEV_TRUST_LOCAL_BROWSER ?? "1",
  GRABBOTS_ENABLE_DEFAULT_SQUAD: process.env.GRABBOTS_ENABLE_DEFAULT_SQUAD ?? "1",
};

console.log(`[GrabBots] Starting backend on http://127.0.0.1:${sharedEnv.OMB_PORT}...`);
const serverProcess = spawn(
  process.execPath,
  ["--experimental-strip-types", "server/dev-server.ts"],
  {
    cwd: rootDir,
    stdio: "inherit",
    env: sharedEnv,
  },
);

serverProcess.on("error", (err) => {
  console.error("[GrabBots Server Error]:", err);
});

console.log(`[GrabBots] Starting UI on http://127.0.0.1:${sharedEnv.OMB_UI_PORT}...`);
const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const uiProcess = spawn(pnpmCmd, ["dev"], {
  cwd: rootDir,
  stdio: "inherit",
  shell: true,
  env: sharedEnv,
});

uiProcess.on("error", (err) => {
  console.error("[GrabBots UI Error]:", err);
});

const cleanup = () => {
  console.log("\n[GrabBots] Shutting down...");
  serverProcess.kill();
  uiProcess.kill();
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
