#!/usr/bin/env node
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wrapper = resolve(root, "scripts/with-app-env.mjs");
const child = spawn(process.execPath, [wrapper, "vite", "dev", "--host", "0.0.0.0", "--port", "8080"], {
  cwd: root,
  stdio: "inherit",
  windowsHide: true,
  env: { ...process.env, ALLOW_DEV_CSP: "1", SEED_DEMO: "1", ECHO_OTP: "1" },
});
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => child.kill(signal));
child.on("error", (error) => { console.error("[dev]", error.message); process.exit(127); });
child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
