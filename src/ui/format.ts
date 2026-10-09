// Short, readable number and time formats for a 180px wide screen.

export function formatNumber(n: number): string {
  const v = Math.floor(n);
  if (v < 10000) return v.toLocaleString('en-US');
  const units = [
    { v: 1e12, s: 't' },
    { v: 1e9, s: 'b' },
    { v: 1e6, s: 'm' },
    { v: 1e3, s: 'k' },
  ];
  for (const u of units) {
    if (v >= u.v) {
      const x = v / u.v;
      return `${x >= 100 ? Math.floor(x) : Math.floor(x * 10) / 10}${u.s}`;
    }
  }
  return String(v);
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}
