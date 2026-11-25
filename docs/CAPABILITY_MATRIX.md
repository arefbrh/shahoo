# SHAHOO — Capability & Verification Matrix

**Compared against:** repository `main` and the Antigravity V2 ZIP  
**Updated:** 24 November 2026

| Area | Files / capability | Source status | Verification status | Remaining gate |
|---|---|---|---|---|
| Core storefront | TanStack Start, catalog, cart, checkout | Existing in repository | Existing CI evidence only | Full current CI and browser E2E |
| City selection | `src/lib/iran-cities.ts`, `checkout-view.tsx` | Added in ZIP; manual-city fallback retained | Not run | Typecheck and mobile checkout E2E |
| Carrier tracking | `src/lib/carrier-tracking.ts`, `order-view.tsx` | Added in ZIP | Not run | Portal destinations checked; query-prefill and representative shipment codes not tested |
| FAQ/CMS defaults | `cms-defaults.ts`, `product-faq.tsx`, CMS content | Added in ZIP; existing Persian FAQ text preserved | Not run | Confirm existing database FAQ rows remain unchanged |
| Trust marks | `DEFAULT_TRUST_MARKS` | Pending defaults only | Source-reviewed | Never activate without actual approval |
| Invoice | JPG minimal logo with PNG fallback | Added in ZIP | Not run | Browser print and image-export test |
| XLSX export | `sanitizeSpreadsheetText`, XML builder | Added in ZIP | Test added to candidate | Run test suite and inspect generated workbook |
| Torob feed | `/api/torob/products` | Added in ZIP; schema and route-tree defects corrected | Not run | Confirm Torob's current feed contract and verify output |
| Database | PostgreSQL, Drizzle, migrations, separate admin/runtime roles | Existing; first-boot init SQL added for Docker | Not run on VPS | Fresh/upgrade parity, role grants and concurrency |
| Docker | `Dockerfile`, `docker-compose.yml`, `.dockerignore` | Added and corrected | Static review only | `docker compose config`, build and container runtime test |
| Worker | maintenance loop + heartbeat | Added and corrected | Static review only | Runtime failure/restart test on PostgreSQL |
| Reverse proxy | Caddy Docker and Windows configs | Added and corrected | Not run | DNS, ACME, HTTPS and proxy-header validation |
| Backup / restore | Linux DB/media and Windows DB scripts | Added and corrected | Static review only | Encrypted/off-site backup, WAL/PITR and restore drill |
| Monitoring | Linux container and Windows host checks | Added | Static review only | Scheduled execution and alert delivery |
| PayPing | Existing adapter and lifecycle | Source-integrated; disabled by default | Mock/source tests only | Merchant sandbox, amount-unit confirmation, PostgreSQL evidence |
| SMS.ir | Existing Verify adapter | Source-integrated; disabled by default | Mock/source tests only | Approved template and authorized sandbox delivery |
| Production hosting | Vercel/Neon history; self-host target | Not migrated | Not verified | Choose and provision target host; explicit owner cutover approval |

**Status definitions:** Source status means code is present; it does not imply a successful build, test, Preview check or Production verification.
