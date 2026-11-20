/** Apply a set only when the line still has the quantity the customer observed. */
export function cartSetDecision(previous: number, expected?: number): "apply" | "conflict" {
  return expected === undefined || previous === expected ? "apply" : "conflict";
}
