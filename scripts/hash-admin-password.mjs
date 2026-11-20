import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2] ?? "";
if (password.length < 10) {
  console.error("Usage: node scripts/hash-admin-password.mjs '<password, at least 10 characters>'");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
process.stdout.write(`s2$${salt.toString("base64url")}$${hash.toString("base64url")}\n`);
