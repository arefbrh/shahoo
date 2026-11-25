import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, chmodSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(".");
const linux = (name) => resolve(`scripts/linux/${name}`);

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "shahoo-linux-safety-"));
  const bin = join(dir, "bin");
  mkdirSync(bin);
  const log = join(dir, "docker.log");
  const fakeDocker = join(bin, "docker");
  writeFileSync(fakeDocker, `#!/bin/sh
echo "$*" >> "$DOCKER_LOG"
case "$*" in
  *"printenv POSTGRES_DB") echo shahoo_db; exit 0 ;;
  *"printenv POSTGRES_USER") echo shahoo_admin; exit 0 ;;
  *"printenv APP_DB_USER") echo shahoo_app; exit 0 ;;
  *"stop app worker") exit "\${DOCKER_STOP_EXIT:-0}" ;;
  *"dropdb"*) exit "\${DOCKER_DROPDB_EXIT:-0}" ;;
  *"exec -T app sh -c"*) exit "\${DOCKER_MEDIA_EXEC_EXIT:-0}" ;;
  *"run --rm --no-deps -T --entrypoint sh app -c"*) exit "\${DOCKER_MEDIA_EXEC_EXIT:-0}" ;;
  *) exit 0 ;;
esac
`);
  chmodSync(fakeDocker, 0o755);
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, DOCKER_LOG: log };
  const dump = join(dir, "backup.dump");
  writeFileSync(dump, "test dump");
  const goodDir = join(dir, "good");
  mkdirSync(join(goodDir, "media"), { recursive: true });
  writeFileSync(join(goodDir, "media", "image.bin"), "image");
  const goodArchive = join(dir, "good.tar.gz");
  const pack = spawnSync("tar", ["-czf", goodArchive, "-C", goodDir, "media"]);
  assert.equal(pack.status, 0);
  const linkDir = join(dir, "links");
  mkdirSync(join(linkDir, "media"), { recursive: true });
  symlinkSync("/etc/passwd", join(linkDir, "media", "sneaky"));
  const symlinkArchive = join(dir, "symlink.tar.gz");
  assert.equal(spawnSync("tar", ["-czf", symlinkArchive, "-C", linkDir, "media"]).status, 0);
  const badDir = join(dir, "bad");
  mkdirSync(badDir);
  writeFileSync(join(badDir, "escape"), "bad");
  const badArchive = join(dir, "bad.tar.gz");
  const badPack = spawnSync("tar", ["-czf", badArchive, "-C", badDir, "--transform=s#^escape#../escape#", "escape"]);
  assert.equal(badPack.status, 0);
  return { dir, env, log, dump, goodArchive, badArchive, symlinkArchive };
}

function run(script, args, env, input = "") {
  return spawnSync(script, args, { cwd: root, env, input, encoding: "utf8" });
}

test("Linux backup scripts reject invalid retention before calling Docker", (t) => {
  const f = fixture(); t.after(() => rmSync(f.dir, { recursive: true, force: true }));
  const db = run(linux("backup-db.sh"), [join(f.dir, "db"), "0"], f.env);
  const media = run(linux("backup-media.sh"), [join(f.dir, "media"), "invalid"], f.env);
  assert.equal(db.status, 2);
  assert.equal(media.status, 2);
  assert.equal((awaitRead(f.log)), "");
});

function awaitRead(path) {
  try { return requireRead(path); } catch { return ""; }
}
function requireRead(path) {
  return readFileSync(path, "utf8");
}

test("Linux media restore rejects path traversal before stopping services", (t) => {
  const f = fixture(); t.after(() => rmSync(f.dir, { recursive: true, force: true }));
  const result = run(linux("restore-media.sh"), [f.badArchive], f.env, "RESTORE\n");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unsafe archive path rejected/);
  assert.equal(awaitRead(f.log), "");
});

test("Linux media restore restarts services if stopping fails before replacement", (t) => {
  const f = fixture(); t.after(() => rmSync(f.dir, { recursive: true, force: true }));
  const result = run(linux("restore-media.sh"), [f.goodArchive], { ...f.env, DOCKER_STOP_EXIT: "1" }, "RESTORE\n");
  assert.equal(result.status, 1);
  assert.match(awaitRead(f.log), /start app worker/);
  assert.doesNotMatch(awaitRead(f.log), /run --rm --no-deps/);
});

test("Linux media restore leaves services stopped after replacement has begun and extraction fails", (t) => {
  const f = fixture(); t.after(() => rmSync(f.dir, { recursive: true, force: true }));
  const result = run(linux("restore-media.sh"), [f.goodArchive], { ...f.env, DOCKER_MEDIA_EXEC_EXIT: "1" }, "RESTORE\n");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /remain stopped/);
  assert.doesNotMatch(awaitRead(f.log), /start app worker/);
  assert.match(awaitRead(f.log), /run --rm --no-deps -T --entrypoint sh app/);
  assert.doesNotMatch(awaitRead(f.log), /exec -T app/);
});

test("Linux media scripts fail closed when S3 storage is configured", (t) => {
  const f = fixture(); t.after(() => rmSync(f.dir, { recursive: true, force: true }));
  const env = { ...f.env, STORAGE_PROVIDER: "s3" };
  const backup = run(linux("backup-media.sh"), [join(f.dir, "media")], env);
  const restore = run(linux("restore-media.sh"), [f.goodArchive], env, "RESTORE\n");
  assert.equal(backup.status, 2);
  assert.equal(restore.status, 2);
  assert.match(restore.stderr, /STORAGE_PROVIDER=s3/);
  assert.equal(awaitRead(f.log), "");
});

test("Linux restore rejects symlink archive entry before stopping services", (t) => {
  const f = fixture(); t.after(() => rmSync(f.dir, { recursive: true, force: true }));
  const result = run(linux("restore-media.sh"), [f.symlinkArchive], f.env, "RESTORE\n");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unsafe archive entry type/);
  assert.equal(awaitRead(f.log), "");
});

test("Linux database restore restarts services if stop fails before destructive work", (t) => {
  const f = fixture(); t.after(() => rmSync(f.dir, { recursive: true, force: true }));
  const result = run(linux("restore-db.sh"), [f.dump], { ...f.env, DOCKER_STOP_EXIT: "1" }, "RESTORE\n");
  assert.equal(result.status, 1);
  assert.match(awaitRead(f.log), /start app worker/);
  assert.doesNotMatch(awaitRead(f.log), /dropdb/);
});

test("Linux database restore leaves services stopped after database replacement begins and fails", (t) => {
  const f = fixture(); t.after(() => rmSync(f.dir, { recursive: true, force: true }));
  const result = run(linux("restore-db.sh"), [f.dump], { ...f.env, DOCKER_DROPDB_EXIT: "1" }, "RESTORE\n");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /remain stopped/);
  assert.doesNotMatch(awaitRead(f.log), /start app worker/);
});
