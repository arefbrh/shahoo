/** Reject markup and ASCII control characters without a control-character regex. */
export function hasUnsafeText(text: string): boolean {
  if (text.includes("<") || text.includes(">")) return true;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 32 || code === 127) return true;
  }
  return false;
}
