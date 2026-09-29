/** Parses what the user typed: "27,6", "27.6%", "$31", " 10 ". Returns null if it is not a number. */
export function parseUserNumber(text: string): number | null {
  const cleaned = text.replace(/[\s$%]/g, '').replace(',', '.');
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
