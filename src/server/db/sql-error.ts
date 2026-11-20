/** Walk driver and Drizzle wrappers for a Postgres SQLSTATE / constraint name. */

function walk(error: unknown, key: "code" | "constraint"): string | null {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const record = current as { code?: unknown; constraint?: unknown; cause?: unknown };
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      if (key === "code" && !/^[0-9A-Z]{5}$/.test(value)) {
        current = record.cause;
        continue;
      }
      return value;
    }
    current = record.cause;
  }
  return null;
}

export function postgresSqlState(error: unknown): string | null {
  return walk(error, "code");
}

export function postgresConstraint(error: unknown): string | null {
  return walk(error, "constraint");
}

/** Unique violation on the order idempotency constraint. Message text is not consulted. */
export function isIdempotencyConflict(error: unknown): boolean {
  if (postgresSqlState(error) !== "23505") return false;
  const constraint = postgresConstraint(error) ?? "";
  return constraint.includes("idempotency");
}
