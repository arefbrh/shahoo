# SHAHOO — Current issue index

**Last reconciled:** 2026-11-27

GitHub Issues are the sole live issue tracker. This file is only a compact navigation index; do not copy full descriptions, status discussions or test results here. Update the GitHub Issue and [Project Master Report](docs/PROJECT_MASTER_REPORT.md) when the release posture or verified evidence materially changes.

## Release and environment verification

- [#13 — Production schema backup and upgrade 0016 → 0019](https://github.com/shahoo-workspace/shahoo/issues/13)
- [#14 — Preview guest checkout and Staging shipping method](https://github.com/shahoo-workspace/shahoo/issues/14)
- [#15 — Authenticated Preview admin and media lifecycle](https://github.com/shahoo-workspace/shahoo/issues/15)
- [#16 — Target VPS recovery/reboot rehearsal](https://github.com/shahoo-workspace/shahoo/issues/16)
- [#17 — Review/execute PR #12 schema and PostgreSQL checks](https://github.com/shahoo-workspace/shahoo/issues/17)
- [#18 — Provider account, templates, Sandbox and activation decision](https://github.com/shahoo-workspace/shahoo/issues/18)

## Payment and provider correctness

- [#20 — PayPing terminal states and customer payment-again flow](https://github.com/shahoo-workspace/shahoo/issues/20)
- [#21 — PayPing browser return/callback contract](https://github.com/shahoo-workspace/shahoo/issues/21)
- [#22 — Payment reconciliation, alerting and refund recovery](https://github.com/shahoo-workspace/shahoo/issues/22)

## Windows, database and security hardening

- [#23 — Windows least-privilege service account and ACLs](https://github.com/shahoo-workspace/shahoo/issues/23)
- [#24 — Separate Windows runtime/admin environment credentials](https://github.com/shahoo-workspace/shahoo/issues/24)
- [#25 — Separate migration owner and runtime database roles](https://github.com/shahoo-workspace/shahoo/issues/25)
- [#26 — Windows worker task schedule and heartbeat](https://github.com/shahoo-workspace/shahoo/issues/26)
- [#27 — Windows release, upgrade and rollback runbook](https://github.com/shahoo-workspace/shahoo/issues/27)
- [#28 — Safe database restore with snapshot/scratch restore](https://github.com/shahoo-workspace/shahoo/issues/28)
- [#29 — PostgreSQL Pool idle-client error handling](https://github.com/shahoo-workspace/shahoo/issues/29)
- [#30 — OTP hardening and SMS-pumping controls](https://github.com/shahoo-workspace/shahoo/issues/30)
- [#31 — Guest stock-hold abuse review](https://github.com/shahoo-workspace/shahoo/issues/31)
- [#32 — Lower-priority hardening review](https://github.com/shahoo-workspace/shahoo/issues/32)
- [#33 — Historical Preview OAuth credential rotation and full-history scan](https://github.com/shahoo-workspace/shahoo/issues/33)
- [#35 — DDoS, bot-abuse, WAF/edge protection and bounded Staging verification](https://github.com/shahoo-workspace/shahoo/issues/35)
- [#36 — Repository licensing, third-party notices and asset-rights evidence](https://github.com/shahoo-workspace/shahoo/issues/36)

## Product knowledge integration

- [#37 — Connect Oil Encyclopedia v3.2 only to the oil recommendation engine](https://github.com/shahoo-workspace/shahoo/issues/37)

## Rules

- Search before creating a new Issue to avoid duplicates.
- Every Issue should include source evidence, impact, acceptance criteria and a verification plan.
- Keep actual secrets, passwords, connection strings, OTPs and customer data out of public Issues and PRs.
- Do not close an Issue merely because source code changed; attach successful test or operational evidence first.
