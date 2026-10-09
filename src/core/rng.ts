// Random number sources. Gameplay takes an Rng so tests can use a seeded one.

export type Rng = () => number;

export const mathRng: Rng = () => Math.random();

/** Mulberry32: small, fast, good enough for games and deterministic tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash of an integer and a seed, mapped to [0, 1). */
export function hash01(n: number, seed: number): number {
  let h = (Math.imul(n | 0, 0x9e3779b1) ^ Math.imul(seed | 0, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/** Stable hash of a string (FNV-1a), for seeding placeholder art from ids. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function randRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Pick from weighted entries. Returns undefined only for an empty or zero-weight list. */
export function weightedPick<T>(entries: readonly { item: T; weight: number }[], rng: Rng): T | undefined {
  let total = 0;
  for (const e of entries) total += Math.max(0, e.weight);
  if (total <= 0) return undefined;
  let r = rng() * total;
  for (const e of entries) {
    const w = Math.max(0, e.weight);
    if (r < w) return e.item;
    r -= w;
  }
  // Floating point edge: return the last positive entry.
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e && e.weight > 0) return e.item;
  }
  return undefined;
}
