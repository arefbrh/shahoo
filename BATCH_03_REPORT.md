# Batch 03 Report — Frontend Routes, UI Reliability & Client-State Consistency (2026-11-18)

Baseline: `SHAHOO-v1.0.0-batch02-correction.zip` (the Batch 02 correction, built from the owner's batch02 ZIP). Output: `SHAHOO-v1.0.0-batch03.zip`. Scope: frontend only. No migration, no schema change, no new dependency, no server commerce change. Homepage, hero, cart drawer, profile demographics and new account sections were not touched (Batch 04+). Batch 04 was **not** started.

## 1. What was verified, changed and why

### A. Routes and navigation
- Verified (static): every internal `to=` / `href=` in `src/**/*.tsx` resolves to an existing route file; the removed `/account/support` route is linked nowhere; every layout route with children renders an `Outlet`; lookup routes turn a missing record into a not-found state.
- Changed: `src/router.tsx` registers a Persian `defaultNotFoundComponent` (`AppNotFoundComponent`). `src/lib/error-component.tsx` no longer prints the thrown error text (it could carry database or path details); it logs to the console only and shows a fixed Persian message with a retry button and a link home. `magazine.$articleId.tsx`: cover image now has real alt text.
- Not changed: server-side route guards and admin permission checks (not edited, not weakened).

### B/C. Feedback states and cart
- New `src/components/site/use-guarded-action.ts`: one async action at a time, `pending` flag, second click ignored, a thrown error becomes a fixed Persian message (no raw error), success text only when the server answered `ok: true`. Used by order actions and the review form (buttons disabled while pending; messages use `role="alert"` / `role="status"`).
- New `src/lib/cart-ui-rules.ts`: `createLatestGate` (only the newest cart response may update the screen), draft quantity clamp, Persian read/update failure messages. `cart-view.tsx` uses a busy guard, drops stale responses, keeps the previous cart and shows an error with retry when a write or read fails, and no longer writes on every keystroke. Prices and totals still come only from the server.
- `shell.tsx`: a failed cart-count read keeps the last known count instead of showing an empty cart.
- `address-book.tsx`: single pending operation, load-failure state with retry, success/failure messages tied to the real server result.

### D. Wishlist isolation
- Root cause: the persisted browser wishlist had no owner. After logout, or a login as someone else, the old list stayed in `localStorage`, could be shown, and a leftover account list could be merged into the next account.
- Fix (existing zustand store, no new library): `src/lib/wishlist-rules.ts` + `src/lib/cart-store.ts`. The list is tagged `guest` / `account` / `unknown` (persist version 2; an old untagged list becomes `unknown`: kept for display as guest only if guest, never merged). `reconcile` aligns the browser copy with the server session on the product and wishlist pages; logout and login-as-another call `clearForLogout`; only a genuine guest list is merged on login; a failed toggle leaves the list unchanged and says so; the heart is disabled while a request runs. The old `toggle` store action was removed (its only caller was replaced).

### E. Media upload UX
- New `src/lib/media-upload-client.ts` (pure, fetch injected): immediate Persian messages for missing/empty/wrong-type/too-large file; success only on `{ok: true}`; network error, unreadable reply or `ok:false` are failures that can be retried. `content-desk.tsx` uses it, shows pending state, disables the button during upload and registration, does not read the event after an `await`, and previews fall back to a "بدون تصویر" placeholder when an image fails to load. Storage architecture unchanged.

### F. Accessibility (source-level)
- Skip link and `main#main-content`; Escape closes the mobile menu; `aria-label` on search inputs and on the return-reason / review textareas; shared field style (`ui.ts`) no longer removes the outline (visible `focus-visible` ring in forest green, brand palette unchanged); status/alert roles on feedback messages.
- Contrast computed from the palette (`styles.css`): ink/ivory 14.0, muted/ivory 5.37, forest/ivory 11.55, deep/gold 4.79, gold/forest 4.35, **gold/ivory 2.66** (below 4.5 for small text). Palette was not changed (approved brand); see remaining issues.

### G. Responsive
- No layout change was made. Not verified in a browser (see "not executed"). Admin tables were reviewed statically for horizontal scroll wrappers.

## 2. Files changed
New: `src/components/site/use-guarded-action.ts`, `src/lib/cart-ui-rules.ts`, `src/lib/wishlist-rules.ts`, `src/lib/media-upload-client.ts`, and tests `src/lib/cart-ui-rules.test.ts`, `src/lib/wishlist-rules.test.ts`, `src/lib/media-upload-client.test.ts`, `scripts/frontend-source.test.mjs`.
Modified: `src/router.tsx`, `src/lib/error-component.tsx`, `src/lib/cart-store.ts`, `src/components/site/{account-panel,address-book,cart-view,content-desk,order-actions,product-view,reviews-panel,shell,ui}`, `src/routes/{wishlist,magazine.$articleId}.tsx`, `package.json` (test script lists the three new test files), and the documents. No existing test was edited or removed.

## 3. Tests added
- `wishlist-rules.test.ts` (8): account isolation on logout/login-as-another, guest list kept, unknown list never merged, failed toggle leaves state unchanged, duplicate toggle safe.
- `cart-ui-rules.test.ts` (4): stale-response gate, quantity clamp.
- `media-upload-client.test.ts` (6): type/size/empty errors, success only on server `ok`, failure then retry, unreadable reply.
- `scripts/frontend-source.test.mjs` (9, static file inspection): links resolve to routes, removed support route unlinked, layouts render `Outlet`, not-found handling, router error/not-found screens never print the raw error, wishlist scope wiring, cart guards, upload guard, accessibility basics.

## 4. Check results (2026-11-18)
| Check | Result |
|---|---|
| New pure tests (`wishlist-rules` 8, `cart-ui-rules` 4, `media-upload-client` 6) | EXECUTED — PASS (18/18) |
| `scripts/frontend-source.test.mjs` | EXECUTED — PASS (9/9). Static inspection, not a browser |
| All app test files that import without installed packages | EXECUTED — PASS (88 passed, 0 failed) |
| Platform script tests `node --test 'scripts/**/*.test.mjs'` | EXECUTED — FAIL (213 tests: 202 pass, 11 fail). The same 11 tests (same names) fail on the unmodified Batch 02 correction archive: missing `.grok/` platform folder and missing installed packages in this sandbox. 9 of the 213 are the new source tests |
| Syntax parse (TypeScript 6.0.3 `transpileModule`) of all new/edited `.ts`/`.tsx` | EXECUTED — PASS. Syntax only, not a typecheck |
| `npx tsc --noEmit` | NOT EXECUTED — no network, no `node_modules`; `@types/react`, TanStack Router and zustand are not available offline |
| `npx eslint . --quiet` | NOT EXECUTED — same reason |
| `npm run build` | NOT EXECUTED — same reason |
| Drizzle/PGlite suites (incl. `correction.test.ts`, `batch02.test.ts`, `flow.test.ts`) | NOT EXECUTED — packages not importable here |
| Real browser tests at 360×800, 390×844, 768×1024, 1440×900 | NOT EXECUTED — Chromium exists in the sandbox, but the app cannot be built or served without `node_modules`. No responsive or keyboard behaviour was observed in a browser |
| React component rendering tests (dialog focus, duplicate click in a DOM) | NOT EXECUTED — no test renderer/DOM library installed; covered only by pure-logic tests and static inspection |
| Gateway / SMS / carrier | NOT APPLICABLE |

## 5. Remaining issues and risks
- Because tsc, eslint, build and any DOM rendering did not run, type errors, lint errors or runtime defects in the edited `.tsx` files are possible. These must be run first: `npm ci`, `npx tsc --noEmit`, `npx eslint . --quiet`, `env -u DATABASE_URL npm test`, build with `DATABASE_URL` unset.
- Also still unexecuted from the Batch 02 correction: `correction.test.ts` and the edited `flow.test.ts` fixture.
- Responsive and keyboard behaviour, drawer/dialog focus trapping and touch-target sizes were not browser-verified. No upload progress bar exists (pending state only).
- `gold` text on `ivory`/`paper` is 2.66–2.74:1. It is brand palette; fix would be a design decision (e.g. darker gold for small text) for the owner.
- The product page now calls `wishlistStateFn` on load to reconcile; this is one extra read per product view.
- Server-side media reference checks and admin tables were not changed.

## 6. Deviations from scope
None known. No homepage, hero, cart drawer, profile, backend or schema change.

## 7. Suggested next steps for Batch 04
Run the unexecuted checks above first. Then the approved homepage sections, cart drawer and carousel work, reusing `useGuardedAction`, `createLatestGate` and the wishlist scope rules rather than adding new patterns. Do not start before owner approval.

---

## Batch 03 correction (2026-11-18)

Input: the Claude-generated `SHAHOO-v1.0.0-batch03.zip` (386 regular files, verified identical to the archive delivered earlier). Output: `SHAHOO-v1.0.0-batch03-correction.zip`. Independent review findings only; no Batch 04 work, no redesign, no schema or business-rule change.

### Correction A — guest wishlist data loss during login (verified present)
- **Root cause.** `SignIn.verifyCode` in `account-panel.tsx` called `mergeWishlistFn(...).catch(() => undefined)` and then cleared the browser list unconditionally. `mergeWishlistForSession` returns `{mode:"account",items}` on success, `{mode:"guest",items:[]}` when there is no session and `{ok:false,message}` on failure, and `mergeSaved` silently skips deleted products and accepts at most 40 ids. A rejection, `{ok:false}` or `{mode:"guest"}` all ended in the guest list being wiped.
- **Fix.** New `src/lib/wishlist-sync.ts` (framework-free controller; store and server calls injected) plus rules in `src/lib/wishlist-rules.ts` (`WishlistSnapshot`, `parseMergeReply`, `snapshotAfterLogout`, `snapshotWithoutSession`, `chunk`, `createReadGate`). The store (`cart-store.ts`, persist version 3) gains a persisted `pending` list: guest data not yet confirmed by the server, kept apart from `ids` (the visible list, tagged `guest`/`account`/`unknown`). `migrate()` writes the intent to `pending` before the first request, sends batches of at most 40, treats only an explicit `{mode:"account", items:[...]}` as success, treats a rejection, `{ok:false}`, `{mode:"guest"}` and unknown shapes as failure, removes ids from `pending` only batch by batch after confirmation, reports ids the server skipped because the product no longer exists, and on full success replaces the browser list with the server list (`scope:"account"`, `pending:[]`). A second call while one runs returns `busy` (no duplicate request); retries are idempotent (client de-duplication plus the server's `ON CONFLICT DO NOTHING`). After a failed login-time migration the customer is still signed in and `/account` shows a Persian notice with a retry button (`WishlistMigrationNotice`, reads `pending`, persists across refresh). `logout()` drops an account copy but returns unmigrated `pending` ids to the guest list, so nothing is lost. If the session disappears while data is pending, `load()` folds it back into the guest list. An account copy is never merged into another customer.
- **Decision.** Guest ids that never reached the server belong to the browser, not to a customer, so a later sign-in (even as a different customer, if the first never completed) may receive them; another customer's *account* list is never merged (`idsToMergeOnLogin` ignores `account`/`unknown` scope).

### Correction B — stale wishlist response race (verified present)
- **Root cause.** `ProductView` fired `wishlistStateFn().then(reconcile)` on mount with no ordering against the heart action, so an older read could overwrite a newer toggle.
- **Fix.** `createReadGate` (mutation revision plus read sequence) is owned by the sync controller. `toggle()` and `migrate()` bump the revision when they start and when they finish; `load()` is applied only if no action is running, none ran since the read began, and it is the newest read; otherwise it returns `stale` and changes nothing. A failed read changes nothing and can be retried. `ProductView` and `/wishlist` now use `wishlistSync` (`src/components/site/wishlist-client.ts` binds the real store and server functions). The wishlist route shows its failure/retry state for a failed read and keeps the current list for a stale one. No library added.

### Correction C — documentation
`SHAHOO_MASTER_CONTEXT_AND_HANDOFF.md` header and status rewritten (Batch 00–02 history, Batch 03, this correction, limits, Batch 04 only after approval). `FILE_INVENTORY.md` recounted (386 regular files at the start of this pass; method stated in the file). `AGENTS.md` rewritten as portable instructions; the original Grok-platform file is kept as `docs/archive/AGENTS.grok-platform-original.md`. `BATCH_08_PRODUCTION_REPORT.md` marked historical (it describes v0.8.0). Other canonical documents updated.

### Files changed
New: `src/lib/wishlist-sync.ts`, `src/lib/wishlist-sync.test.ts`, `src/components/site/wishlist-client.ts`, `docs/archive/AGENTS.grok-platform-original.md`. Modified: `src/lib/wishlist-rules.ts`, `src/lib/cart-store.ts` (the `clearForLogout` store action was removed; logout goes through `wishlistSync.logout()`), `src/components/site/account-panel.tsx`, `src/components/site/product-view.tsx`, `src/routes/wishlist.tsx`, `scripts/frontend-source.test.mjs` (the one static wishlist test was updated to the new wiring and gained assertions), `package.json` (test script lists `wishlist-sync.test.ts`), `AGENTS.md`, `BATCH_08_PRODUCTION_REPORT.md`, `FILE_INVENTORY.md` and the canonical documents. No existing test was removed or skipped.

### Tests added (`src/lib/wishlist-sync.test.ts`, 19 tests, executed)
They run the real controller and rules. Only the browser store and the three server calls are in-memory fakes that return the exact reply shapes of `src/server/account/wishlist.ts` (idempotent merge, skipped unknown products). Covered: successful migration; `{ok:false}`; rejected request; `{mode:"guest"}` and unknown shapes; intent persisted before the first request; retry after failure and repeated retries without duplicates; second migrate ignored while one runs; partial migration (skipped products; second batch failing keeps only unconfirmed ids); logout after success; logout after failed migration; login as a different customer without leakage; guest list merged only into the signing-in customer; session lost while pending; stale read after a toggle (initial fetch, toggle, old fetch resolves, final state is the toggle); stale read begun during a toggle; only the newest of two reads applied; ordinary successful and failed initial fetch; toggle failure and double click.

### Check results (2026-11-18)
| Check | Status |
|---|---|
| `node --experimental-strip-types --test src/lib/wishlist-sync.test.ts src/lib/wishlist-rules.test.ts` | EXECUTED — PASS (27/27) |
| All app test files importable without installed packages (command per file) | EXECUTED — PASS (107 passed, 0 failed; 15 other app test files cannot import `drizzle-orm`/`@electric-sql/pglite`/etc.) |
| `node --test scripts/frontend-source.test.mjs` | EXECUTED — PASS (9/9); STATIC REVIEW ONLY in nature (reads source text, not an automated behaviour test) |
| `node --test 'scripts/**/*.test.mjs'` | EXECUTED — FAIL: 213 run, 202 pass, 11 fail. The same 11 tests (same names) fail on the unmodified Batch 03 archive: missing `.grok/` platform folder and missing installed packages. Pre-existing (baseline comparison run). Two of them (`brand-check`) pin the old platform `AGENTS.md`; they could not pass before and cannot now |
| TypeScript syntax parse of all new/edited files | EXECUTED — PASS (syntax only, not a typecheck) |
| `npx tsc --noEmit` | NOT EXECUTED — ENVIRONMENT LIMITATION (no network, no `node_modules`; `npm view react` fails) |
| `npx eslint . --quiet` | NOT EXECUTED — ENVIRONMENT LIMITATION |
| `npm run build` | NOT EXECUTED — ENVIRONMENT LIMITATION |
| Database/PGlite tests (`correction.test.ts`, `batch02.test.ts`, `flow.test.ts`, others, 15 files) | NOT EXECUTED — ENVIRONMENT LIMITATION |
| Real PostgreSQL tests | NOT EXECUTED in this pass (the Batch 02 correction ran `scripts/pg-media-race.sh` on PostgreSQL 16; unrelated to this change) |
| Browser tests: login, wishlist migration, retry, logout, account switching; responsive checks | NOT EXECUTED — ENVIRONMENT LIMITATION (app cannot be built or served without dependencies) |
| React rendering test of `WishlistMigrationNotice` | NOT EXECUTED — ENVIRONMENT LIMITATION (no DOM/test renderer installed) |

### Remaining risks
- The zustand adapter (`cart-store.ts`, persist migration v2→v3), `wishlist-client.ts`, `WishlistMigrationNotice` and the three edited components were never type-checked, linted, rendered or run in a browser. Run the checks above first.
- The migration notice appears whenever `pending` is non-empty; a refresh in the middle of a request leaves ids pending and shows the retry notice (safe, slightly conservative).
- Ids skipped by the server (deleted products) are dropped from the list without a customer message.
- Earlier-batch gaps are unchanged (see `REMAINING_ISSUES.md`).

### Approval readiness
Implementation complete for corrections A–C; verification incomplete as listed. Batch 04 was not started.
