# Windows VPS compatibility notes

The target is a Windows VPS, not shared hosting. The application should run as a long-lived Node.js process under a service manager such as the operator’s approved Windows service tooling. This audit did not install or configure VPS software.

- Use a supported Node.js LTS version compatible with the locked package toolchain. Run `npm ci` from the project directory and keep `package-lock.json` unchanged.
- Set environment variables through the service account’s environment or an approved secret manager. Do not place `.env` or production credentials in the project ZIP. `.env.example` is intentionally tracked and explicitly unignored.
- Use a real PostgreSQL `DATABASE_URL` in production. Do not use PGlite for production. Apply migrations only through the guarded `npm run db:migrate` procedure with the explicit production confirmation variable.
- Keep outbound TLS certificate validation enabled. PayPing and SMS.ir requests use HTTPS and `fetch`; do not disable certificate verification to work around connectivity issues.
- Ensure the VPS firewall and provider/network policy permit outbound HTTPS. Provider reachability from Iran is an external operational question and was not verified here.
- Configure the reverse proxy/application origin so the PayPing return URL is HTTPS and routes to `/api/payment/payping/callback`. The server-generated URL must match `PAYPING_RETURN_URL` exactly.
- Persist the local storage directory only if the application’s storage configuration explicitly enables it and the Windows service account has the required permissions. This audit did not change storage behavior.
- Configure service restart behavior and logs so a restart cannot silently erase payment attempts. The database is the source of truth for `payment_attempts` and OTP state.
- Keep the process clock synchronized. Payment expiry, OTP expiry, cooldowns, and the five-minute settlement lease use server time.
- Before live activation, run controlled sandbox/mocked tests from the same service account and verify database connectivity, callback reachability, outbound TLS, and restart recovery.
