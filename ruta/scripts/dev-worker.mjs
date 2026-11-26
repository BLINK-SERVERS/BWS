import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

process.loadEnvFile(fileURLToPath(new URL("../.dev.vars", import.meta.url)));

const hijo = spawn("./node_modules/.bin/wrangler", [
  "dev",
  "--env",
  "local",
  "--port",
  "8787",
], {
  cwd: fileURLToPath(new URL("..", import.meta.url)),
  env: process.env,
  stdio: "inherit",
});

hijo.on("exit", (codigo) => process.exit(codigo ?? 1));
process.on("SIGINT", () => hijo.kill("SIGINT"));
process.on("SIGTERM", () => hijo.kill("SIGTERM"));
