# PayPing payment-attempt state machine

The state is stored in `payment_attempts.state`. The database partial unique index treats unresolved states as active per order.

| Current state | Event | Allowed next state | Required validation | Recovery |
|---|---|---|---|---|
| `initiated` | PayPing creation returns a valid payment | `redirect_pending` | Valid HTTPS PayPing URL, payment code, amount | If request throws, move to `provider_outcome_unknown`; do not retry creation |
| `initiated` | Provider request throws/timeout | `provider_outcome_unknown` | Preserve attempt and idempotency key | Admin checks provider dashboard; keep the attempt active in `manual_review` until a safe verification/reconciliation outcome exists |
| `redirect_pending` | Valid callback received | `provider_verified` | POST, bounded body, identifiers/amount match, server verification succeeds | Duplicate callbacks repeat safe verification/settlement handling |
| `redirect_pending` | Verification 202, any non-confirming HTTP status, malformed response, timeout, network or identifier mismatch | `provider_outcome_unknown` | Persist callback reference, `reconciliation_required`, and no settlement | Ownership-checked or authorized-admin verification retry reuses the same provider code/reference; no new initiation |
| `redirect_pending` | Non-confirming verification response | `provider_outcome_unknown` | Current integration has no fully verified provider error-code allowlist for definitive rejection | Do not mark failed based only on HTTP 4xx or malformed response; reconcile with PayPing before any terminal decision |
| `provider_outcome_unknown` | Verification retry succeeds | `provider_verified` | Match original code, client reference, amount and reference | Settle the same attempt with the existing idempotent capture path |
| `provider_outcome_unknown` | Admin checks provider dashboard | `manual_review` | `orders.write`, note | Keep active; verification retry can recover from `manual_review` without creating a new attempt |
| `provider_outcome_unknown` | Provider status cannot be established | `manual_review` | `orders.write`, note | Active index blocks replacement payment |
| `provider_verified` | Settlement claim | `settling` | Persisted provider reference, original amount, provider code/client reference | Lease recovery handles process crash |
| `settling` | Local settlement succeeds | `settled` | Existing capture transaction and idempotency key | Repeated settlement is a no-op/`already` result |
| `settling` | Local settlement fails | `local_settlement_pending` | Preserve verified evidence and error | Retry uses the same attempt/idempotency key |
| `settling` | Process stops | `local_settlement_pending` after five-minute lease | `updated_at` lease check | Next retry reclaims safely |
| `local_settlement_pending` | Authorized retry | `settling` | Customer owns order or internal server path | Same settlement transaction; no new provider payment |
| `manual_review` | Authorized verification retry | `provider_verified` or `provider_outcome_unknown` | Original payment code, amount, client reference and verification reference are reused | Retry remains on the same attempt; no new payment is created |
| `manual_review` | New customer initiation | unchanged/rejected | Active index and server state check | Admin must retry/reconcile; current admin action does not cancel an uncertain payment |
| `settled` | Callback/retry | unchanged | Terminal state | Return already-settled result; no duplicate inventory/payment side effects |

The model intentionally does not invent undocumented provider lookup or refund endpoints. Until PayPing's complete verification rejection contract is confirmed, non-confirming verification responses remain recoverable rather than being converted to `failed`. An internal refund-ledger record is not a bank refund. `failed`, `expired`, and `awaiting_verification` are not active `payment_attempts` states in the current implementation; local order/payment tables retain their own existing terminology.
