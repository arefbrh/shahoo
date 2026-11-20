/** Pure list update for the return desk. A failed action must not change rows. */
export function applyReturnAction<T extends { id: string; status: string }>(
  rows: readonly T[],
  id: string,
  status: string,
): { rows: T[]; updated: boolean } {
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) return { rows: rows.slice(), updated: false };
  const next = rows.map((row, rowIndex) => (rowIndex === index ? { ...row, status } : row));
  return { rows: next, updated: true };
}

export type ReturnHistoryItem = { status: string; note: string; actor: string; at: string };

export type ReturnDeskRow = {
  id: string;
  status: string;
  reason: string;
  amountIrr: number;
  note: string;
  orderCode: string;
  orderStatus: string;
  updatedAt: string;
  history: ReturnHistoryItem[];
};

/** A failed admin action keeps the previous list. A success replaces that row with the server copy. */
export function finishReturnAction<T extends { id: string }>(
  previous: readonly T[],
  outcome: { ok: false; message: string } | { ok: true; row: T },
): { rows: T[]; error: string | null } {
  if (!outcome.ok) return { rows: previous.slice(), error: outcome.message };
  const index = previous.findIndex((row) => row.id === outcome.row.id);
  if (index < 0) return { rows: [outcome.row, ...previous], error: null };
  return { rows: previous.map((row, rowIndex) => (rowIndex === index ? outcome.row : row)), error: null };
}

/** After a successful action the desk must show the reloaded queue, including order status and history. */
export function replaceReturnQueue<T>(previous: readonly T[], outcome: { ok: false; message: string } | { ok: true; rows: readonly T[] }): {
  rows: T[];
  error: string | null;
} {
  if (!outcome.ok) return { rows: previous.slice(), error: outcome.message };
  return { rows: outcome.rows.slice(), error: null };
}
