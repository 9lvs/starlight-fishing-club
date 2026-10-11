// Calendar days in the player's own time zone, as YYYY-MM-DD. Daily features
// key on this so "today" changes at the player's midnight, like Wordle.
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
