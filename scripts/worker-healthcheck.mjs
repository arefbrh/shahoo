import { stat } from "node:fs/promises";

const heartbeat = process.env.WORKER_HEARTBEAT_FILE || "/tmp/shahoo-worker-heartbeat";
const interval = Number(process.env.WORKER_INTERVAL_SECONDS || 300);
if (!Number.isSafeInteger(interval) || interval < 30) {
  console.error("worker interval must be an integer of at least 30 seconds");
  process.exit(1);
}
const taskTimeout = Number(process.env.WORKER_TASK_TIMEOUT_SECONDS || 240);
if (!Number.isSafeInteger(taskTimeout) || taskTimeout < 1) {
  console.error("worker task timeout must be a positive integer");
  process.exit(1);
}
// A valid in-flight task can run for its full timeout before the next heartbeat.
const maxAgeMs = Math.max(600_000, (interval * 2 + taskTimeout) * 1_000);

try {
  const info = await stat(heartbeat);
  if (Date.now() - info.mtimeMs > maxAgeMs) {
    console.error("worker heartbeat is stale");
    process.exit(1);
  }
} catch {
  console.error("worker heartbeat is missing");
  process.exit(1);
}
