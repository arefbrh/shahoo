import { devCspAllowed } from "../server/env/runtime.ts";

/**
 * Relaxed preview CSP (Vite HMR, grok.com frame) is opt-in via ALLOW_DEV_CSP=1
 * and is impossible when NODE_ENV=production.
 * Otherwise the strict policy is used, including in development.
 * `unsafe-inline` stays because TanStack Start emits an inline bootstrap.
 */
export function securityHeaders(https: boolean, env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const relaxed = devCspAllowed(env);
  const ancestors = relaxed
    ? "frame-ancestors 'self' https://grok.com https://*.grok.com https://*.grok.me"
    : "frame-ancestors 'self'";
  const script = relaxed
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://grok.com"
    : "script-src 'self' 'unsafe-inline'";
  const connect = relaxed ? "connect-src 'self' https://grok.com ws: wss:" : "connect-src 'self'";
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    ancestors,
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    script,
    connect,
  ].join("; ");
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Content-Security-Policy": csp,
  };
  if (https) headers["Strict-Transport-Security"] = "max-age=15552000; includeSubDomains";
  return headers;
}
