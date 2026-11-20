/**
 * Tests of the real wishlist controller (`wishlist-sync.ts`) and its rules. Only the browser
 * store and the three server calls are replaced by in-memory fakes that return the exact reply
 * shapes of `src/server/account/wishlist.ts` (`{mode:"account",items}`, `{mode:"guest"}`,
 * `{ok:false,message}`). The zustand adapter itself is not exercised (package not installable offline).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { MERGE_BATCH, createWishlistSync, type WishlistPort, type WishlistServer } from "./wishlist-sync.ts";
import { WISHLIST_MIGRATE_FAILED, WISHLIST_SAVE_FAILED, type WishlistSnapshot } from "./wishlist-rules.ts";

function memoryPort(initial: Partial<WishlistSnapshot> = {}): WishlistPort & { sets: WishlistSnapshot[] } {
  let state: WishlistSnapshot = { ids: [], scope: "guest", pending: [], ...initial };
  const sets: WishlistSnapshot[] = [];
  return {
    sets,
    get: () => ({ ...state, ids: [...state.ids], pending: [...state.pending] }),
    set: (next) => {
      state = { ids: [...next.ids], scope: next.scope, pending: [...next.pending] };
      sets.push(state);
    },
  };
}

type Behaviour = "ok" | "ok-false" | "reject" | "no-session" | "garbage";
/** Fake server mirroring mergeSaved/toggleSaved: idempotent merge, unknown products skipped. */
function fakeServer(opts: { known?: string[]; lists?: Record<string, string[]>; customer?: string | null } = {}) {
  const known = new Set(opts.known ?? ["p1", "p2", "p3", "p4"]);
  const lists: Record<string, Set<string>> = {};
  for (const [id, items] of Object.entries(opts.lists ?? {})) lists[id] = new Set(items);
  const state = { customer: opts.customer === undefined ? "cust-a" : opts.customer, mergeCalls: [] as string[][], behaviour: "ok" as Behaviour };
  const items = (id: string) => [...(lists[id] ??= new Set())].map((pid) => ({ id: pid, name: pid, active: true }));
  const server: WishlistServer = {
    async fetchState() {
      if (!state.customer) return { mode: "guest" };
      return { mode: "account", items: items(state.customer) };
    },
    async toggle(productId) {
      if (!state.customer) return { mode: "guest", items: [] };
      if (!known.has(productId)) return { ok: false, message: "محصول پیدا نشد." };
      const list = (lists[state.customer] ??= new Set());
      if (list.has(productId)) list.delete(productId);
      else list.add(productId);
      return { mode: "account", items: items(state.customer) };
    },
    async merge(ids) {
      state.mergeCalls.push([...ids]);
      if (state.behaviour === "reject") throw new Error("network down");
      if (state.behaviour === "ok-false") return { ok: false, message: "انتقال علاقه‌مندی انجام نشد." };
      if (state.behaviour === "garbage") return { hello: "world" };
      if (!state.customer || state.behaviour === "no-session") return { mode: "guest", items: [] };
      const list = (lists[state.customer] ??= new Set());
      for (const id of new Set(ids)) if (known.has(id)) list.add(id);
      return { mode: "account", items: items(state.customer) };
    },
  };
  return { server, state, lists };
}

const guest = (...ids: string[]): Partial<WishlistSnapshot> => ({ ids, scope: "guest", pending: [] });

// ---------------------------------------------------------------- migration
test("successful migration: guest ids reach the server, then the UI takes the server list", async () => {
  const port = memoryPort(guest("p1", "p2"));
  const { server, lists } = fakeServer({ lists: { "cust-a": ["p3"] } });
  const sync = createWishlistSync(port, server);
  const result = await sync.migrate();
  assert.equal(result.status, "done");
  assert.deepEqual([...lists["cust-a"]].sort(), ["p1", "p2", "p3"]);
  assert.deepEqual(port.get(), { ids: ["p3", "p1", "p2"], scope: "account", pending: [] });
});

test("{ ok: false } keeps every guest id, reports failure and leaves a pending list", async () => {
  const port = memoryPort(guest("p1", "p2"));
  const { server, state } = fakeServer();
  state.behaviour = "ok-false";
  const result = await createWishlistSync(port, server).migrate();
  assert.equal(result.status, "failed");
  assert.equal(result.message, WISHLIST_MIGRATE_FAILED);
  assert.deepEqual(port.get(), { ids: ["p1", "p2"], scope: "guest", pending: ["p1", "p2"] });
});

test("a rejected request keeps every guest id", async () => {
  const port = memoryPort(guest("p1", "p2"));
  const { server, state } = fakeServer();
  state.behaviour = "reject";
  const result = await createWishlistSync(port, server).migrate();
  assert.equal(result.status, "failed");
  assert.deepEqual(port.get().pending, ["p1", "p2"]);
  assert.deepEqual(port.get().ids, ["p1", "p2"]);
});

test("{ mode: 'guest' } (no session) and unknown reply shapes are failures, not success", async () => {
  for (const behaviour of ["no-session", "garbage"] as const) {
    const port = memoryPort(guest("p1"));
    const { server, state } = fakeServer();
    state.behaviour = behaviour;
    assert.equal((await createWishlistSync(port, server).migrate()).status, "failed", behaviour);
    assert.deepEqual(port.get().pending, ["p1"], behaviour);
  }
});

test("the intent is persisted before the first request (a refresh cannot lose the ids)", async () => {
  const port = memoryPort(guest("p1"));
  const { server } = fakeServer();
  let pendingAtRequest: string[] = [];
  const spy: WishlistServer = { ...server, merge: async (ids) => { pendingAtRequest = port.get().pending; return server.merge(ids); } };
  await createWishlistSync(port, spy).migrate();
  assert.deepEqual(pendingAtRequest, ["p1"]);
});

test("retry after failure succeeds and repeated retries create no duplicates", async () => {
  const port = memoryPort(guest("p1", "p2", "p1"));
  const { server, state, lists } = fakeServer();
  const sync = createWishlistSync(port, server);
  state.behaviour = "reject";
  assert.equal((await sync.migrate()).status, "failed");
  state.behaviour = "ok";
  assert.equal((await sync.migrate()).status, "done");
  assert.equal((await sync.migrate()).status, "none", "nothing left to migrate");
  assert.equal((await sync.migrate()).status, "none");
  assert.deepEqual([...lists["cust-a"]].sort(), ["p1", "p2"]);
  assert.deepEqual(port.get().ids.sort(), ["p1", "p2"]);
  assert.deepEqual(port.get().pending, []);
});

test("a second migrate while one runs is ignored (no duplicate request)", async () => {
  const port = memoryPort(guest("p1"));
  const { server, state } = fakeServer();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const slow: WishlistServer = { ...server, merge: async (ids) => { await gate; return server.merge(ids); } };
  const sync = createWishlistSync(port, slow);
  const first = sync.migrate();
  const second = await sync.migrate();
  assert.equal(second.status, "busy");
  release();
  assert.equal((await first).status, "done");
  assert.equal(state.mergeCalls.length, 1);
});

test("partial migration: products that no longer exist are reported, the rest is migrated", async () => {
  const port = memoryPort(guest("p1", "gone"));
  const { server, lists } = fakeServer();
  const result = await createWishlistSync(port, server).migrate();
  assert.equal(result.status, "done");
  assert.deepEqual(result.dropped, ["gone"]);
  assert.deepEqual([...lists["cust-a"]], ["p1"]);
  assert.deepEqual(port.get().pending, []);
});

test("partial migration across batches: a failing second batch keeps only the unconfirmed ids", async () => {
  const ids = Array.from({ length: MERGE_BATCH + 5 }, (_, index) => `p${index}`);
  const port = memoryPort(guest(...ids));
  const { server, state } = fakeServer({ known: ids });
  let calls = 0;
  const flaky: WishlistServer = { ...server, merge: async (part) => { calls += 1; if (calls === 2) throw new Error("drop"); return server.merge(part); } };
  const sync = createWishlistSync(port, flaky);
  assert.equal((await sync.migrate()).status, "failed");
  assert.equal(state.mergeCalls[0].length, MERGE_BATCH);
  assert.deepEqual(port.get().pending, ids.slice(MERGE_BATCH), "confirmed ids leave pending, unconfirmed stay");
  assert.equal(port.get().ids.length, ids.length, "the guest list itself is still intact");
  assert.equal((await sync.migrate()).status, "done");
  assert.deepEqual(port.get().pending, []);
});

// ---------------------------------------------------------------- logout / switching
test("logout after a successful migration leaves an empty guest list", async () => {
  const port = memoryPort(guest("p1"));
  const { server } = fakeServer();
  const sync = createWishlistSync(port, server);
  await sync.migrate();
  sync.logout();
  assert.deepEqual(port.get(), { ids: [], scope: "guest", pending: [] });
});

test("logout after a failed migration keeps the guest data as the guest list", async () => {
  const port = memoryPort(guest("p1", "p2"));
  const { server, state } = fakeServer();
  state.behaviour = "reject";
  const sync = createWishlistSync(port, server);
  await sync.migrate();
  sync.logout();
  assert.deepEqual(port.get(), { ids: ["p1", "p2"], scope: "guest", pending: [] });
});

test("login as a different customer: customer A's account copy is never merged into B", async () => {
  const port = memoryPort(guest("g1"));
  const a = fakeServer({ known: ["g1", "a1", "a2", "b1"], lists: { "cust-a": ["a1", "a2"] } });
  const sync = createWishlistSync(port, a.server);
  await sync.load();
  assert.deepEqual(port.get().ids.sort(), ["a1", "a2"], "A sees A's server list");
  assert.equal(port.get().scope, "account");
  // Session ended without the logout handler running; B signs in on the same browser.
  a.state.customer = "cust-b";
  a.lists["cust-b"] = new Set(["b1"]);
  const result = await sync.migrate();
  assert.equal(result.status, "none", "an account copy is not guest data");
  assert.deepEqual(a.state.mergeCalls, []);
  await sync.load();
  assert.deepEqual(port.get().ids, ["b1"]);
  assert.equal([...a.lists["cust-b"]].includes("a1"), false);
});

test("a guest list that never reached the server is merged into whoever signs in, A's list is not", async () => {
  const port = memoryPort(guest("g1"));
  const env = fakeServer({ known: ["g1", "a1", "b1"], lists: { "cust-a": ["a1"], "cust-b": ["b1"] }, customer: "cust-b" });
  const sync = createWishlistSync(port, env.server);
  await sync.migrate();
  assert.deepEqual([...env.lists["cust-b"]].sort(), ["b1", "g1"]);
  assert.deepEqual([...env.lists["cust-a"]], ["a1"]);
});

test("session lost while guest data is pending: it becomes the guest list again", async () => {
  const port = memoryPort(guest("p1"));
  const env = fakeServer();
  env.state.behaviour = "reject";
  const sync = createWishlistSync(port, env.server);
  await sync.migrate();
  env.state.customer = null;
  await sync.load();
  assert.deepEqual(port.get(), { ids: ["p1"], scope: "guest", pending: [] });
});

// ---------------------------------------------------------------- stale reads
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test("stale read: an initial fetch that resolves after a toggle does not overwrite the newer state", async () => {
  const port = memoryPort({ ids: [], scope: "account", pending: [] });
  const env = fakeServer({ lists: { "cust-a": [] } });
  const slowRead = deferred<Awaited<ReturnType<WishlistServer["fetchState"]>>>();
  const server: WishlistServer = { ...env.server, fetchState: () => slowRead.promise };
  const sync = createWishlistSync(port, server);
  const loading = sync.load(); // 1. initial fetch starts
  const toggled = await sync.toggle("p1"); // 2-3. customer toggles; server now has p1
  assert.equal(toggled.status, "done");
  assert.deepEqual(port.get().ids, ["p1"]);
  slowRead.resolve({ mode: "account", items: [] }); // 4. old response (taken before the toggle) arrives
  assert.equal((await loading).status, "stale");
  assert.deepEqual(port.get().ids, ["p1"], "5. the UI keeps the latest action");
});

test("stale read: a read that started during a toggle is also dropped", async () => {
  const port = memoryPort({ ids: [], scope: "account", pending: [] });
  const env = fakeServer({ lists: { "cust-a": [] } });
  const slowToggle = deferred<unknown>();
  const server: WishlistServer = { ...env.server, toggle: () => slowToggle.promise };
  const sync = createWishlistSync(port, server);
  const toggling = sync.toggle("p1");
  const read = sync.load(); // starts while the toggle is in flight, returns the pre-toggle list
  await read.then((value) => assert.equal(value.status, "stale"));
  slowToggle.resolve({ mode: "account", items: [{ id: "p1" }] });
  await toggling;
  assert.deepEqual(port.get().ids, ["p1"]);
});

test("only the newest of two overlapping reads is applied", async () => {
  const port = memoryPort({ ids: [], scope: "account", pending: [] });
  const first = deferred<Awaited<ReturnType<WishlistServer["fetchState"]>>>();
  const second = deferred<Awaited<ReturnType<WishlistServer["fetchState"]>>>();
  const queue = [first, second];
  const env = fakeServer();
  const sync = createWishlistSync(port, { ...env.server, fetchState: () => queue.shift()!.promise });
  const a = sync.load();
  const b = sync.load();
  second.resolve({ mode: "account", items: [{ id: "new" }] });
  first.resolve({ mode: "account", items: [{ id: "old" }] });
  assert.equal((await b).status, "applied");
  assert.equal((await a).status, "stale");
  assert.deepEqual(port.get().ids, ["new"]);
});

test("ordinary initial fetch is applied; a failed initial fetch changes nothing and can be retried", async () => {
  const port = memoryPort({ ids: ["x"], scope: "guest", pending: [] });
  const env = fakeServer({ lists: { "cust-a": ["p1"] } });
  let fail = true;
  const sync = createWishlistSync(port, { ...env.server, fetchState: async () => { if (fail) throw new Error("offline"); return env.server.fetchState(); } });
  assert.equal((await sync.load()).status, "failed");
  assert.deepEqual(port.get(), { ids: ["x"], scope: "guest", pending: [] });
  fail = false;
  assert.equal((await sync.load()).status, "applied");
  assert.deepEqual(port.get(), { ids: ["p1"], scope: "account", pending: [] });
});

// ---------------------------------------------------------------- toggle
test("toggle failure leaves the list unchanged and reports it; a double click is ignored", async () => {
  const port = memoryPort({ ids: ["p1"], scope: "account", pending: [] });
  const env = fakeServer({ lists: { "cust-a": ["p1"] } });
  const slow = deferred<unknown>();
  const sync = createWishlistSync(port, { ...env.server, toggle: () => slow.promise });
  const first = sync.toggle("p2");
  assert.equal((await sync.toggle("p2")).status, "busy");
  slow.reject(new Error("offline"));
  const result = await first;
  assert.deepEqual(result, { status: "failed", notice: WISHLIST_SAVE_FAILED });
  assert.deepEqual(port.get().ids, ["p1"]);
});
