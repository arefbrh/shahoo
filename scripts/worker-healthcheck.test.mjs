import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, utimesSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const script = resolve("scripts/worker-healthcheck.mjs");

function runHealthcheck({ interval = "30", timeout = "240", heartbeatAgeMs = null } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "shahoo-worker-health-"));
  const heartbeat = join(dir, "heartbeat");
  if (heartbeatAgeMs !== null) {
    writeFileSync(heartbeat, `${Math.floor(Date.now() / 1000)}\n`);
    const time = new Date(Date.now() - heartbeatAgeMs);
    utimesSync(heartbeat, time, time);
  }
  try {
    return spawnSync(process.execPath, [script], {
      encoding: "utf8",
      env: { ...process.env, WORKER_INTERVAL_SECONDS: interval, WORKER_TASK_TIMEOUT_SECONDS: timeout, WORKER_HEARTBEAT_FILE: heartbeat },
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("worker healthcheck fails when heartbeat is missing", () => {
  const result = runHealthcheck();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /heartbeat is missing/);
});

test("worker healthcheck accepts a fresh heartbeat", () => {
  const result = runHealthcheck({ heartbeatAgeMs: 1_000 });
  assert.equal(result.status, 0);
});

test("worker healthcheck rejects a stale heartbeat", () => {
  const result = runHealthcheck({ heartbeatAgeMs: 15 * 60_000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /heartbeat is stale/);
});

test("worker healthcheck fails closed on invalid interval instead of disabling staleness", () => {
  const result = runHealthcheck({ interval: "NaN", heartbeatAgeMs: 1_000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /interval must be an integer/);
});


test("worker healthcheck includes in-flight task timeout in grace period", () => {
  // 30-minute valid task may still be running; 15-minute heartbeat is acceptable.
  const result = runHealthcheck({ interval: "30", timeout: "1800", heartbeatAgeMs: 15 * 60_000 });
  assert.equal(result.status, 0);
});

test("worker healthcheck rejects invalid timeout fail-closed", () => {
  const result = runHealthcheck({ timeout: "NaN", heartbeatAgeMs: 1_000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /task timeout must be a positive integer/);
});
