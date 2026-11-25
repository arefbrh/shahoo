import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const script = resolve("scripts/worker-loop.sh");

function runWorker(env) {
  return spawnSync("sh", [script], { encoding: "utf8", env: { ...process.env, ...env } });
}

test("worker loop rejects an invalid interval before starting work", () => {
  const result = runWorker({ WORKER_INTERVAL_SECONDS: "abc", WORKER_TASK_TIMEOUT_SECONDS: "240" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /WORKER_INTERVAL_SECONDS must be an integer/);
});

test("worker loop rejects a too-short interval before starting work", () => {
  const result = runWorker({ WORKER_INTERVAL_SECONDS: "5", WORKER_TASK_TIMEOUT_SECONDS: "240" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /WORKER_INTERVAL_SECONDS must be at least 30/);
});

test("worker loop rejects invalid task timeout before starting work", () => {
  const result = runWorker({ WORKER_INTERVAL_SECONDS: "300", WORKER_TASK_TIMEOUT_SECONDS: "NaN" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /WORKER_TASK_TIMEOUT_SECONDS must be an integer/);
});

test("worker loop rejects non-positive task timeout before starting work", () => {
  const result = runWorker({ WORKER_INTERVAL_SECONDS: "300", WORKER_TASK_TIMEOUT_SECONDS: "0" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /WORKER_TASK_TIMEOUT_SECONDS must be at least 1/);
});
