#!/usr/bin/env node
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { mergeAppEnv, projectRoot, readAppEnv } from "./with-app-env.mjs";

const root = projectRoot();
const vite = resolve(root, "node_modules/vite/bin/vite.js");
const env = { ...mergeAppEnv(readAppEnv(root), process.env), NITRO_PRESET: "node-server" };
const child = spawn(process.execPath, [vite, "build"], {
  cwd: root,
  stdio: "inherit",
  windowsHide: true,
  env,
});
child.on("error", (error) => {
  console.error("[build:windows]", error.message);
  process.exit(127);
});
child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
