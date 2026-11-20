export function staffOnlyOrderNote(note: string | null | undefined, staff: boolean): string {
  return staff ? note ?? "" : "";
}
