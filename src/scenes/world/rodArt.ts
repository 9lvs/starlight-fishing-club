// Rod art: each rod tier has its own shape, not just its own color. The look
// comes from the rod upgrade's "look" effect in upgrades.json: a shaft color
// and pattern, a grip, a reel, line guides, and something at the tip. Drawn a
// pixel at a time along the rod so it works at any angle (cast, wait, reel).
import type Phaser from 'phaser';
import { color, isPaletteName, type PaletteName } from '../../design/tokens';

export interface RodLook {
  color?: unknown;
  shaft2?: unknown;
  pattern?: unknown;
  grip?: unknown;
  gripLen?: unknown;
  reel?: unknown;
  reelBig?: unknown;
  guides?: unknown;
  tip?: unknown;
  tipStyle?: unknown;
  glow?: unknown;
  twinkle?: unknown;
}

export interface RodDraw {
  /** Where the hand holds the rod, in the graphics' space. */
  hx: number;
  hy: number;
  angle: number;
  len: number;
  /** Glows show at dusk and night. */
  dark: boolean;
  elapsed: number;
  reduced: boolean;
}

const pal = (v: unknown, fallback: PaletteName): PaletteName => (typeof v === 'string' && isPaletteName(v) ? v : fallback);
const num = (v: unknown, fallback: number): number => (typeof v === 'number' ? v : fallback);

/** Draws the rod and returns its tip, for the fishing line. */
export function drawRodArt(g: Phaser.GameObjects.Graphics, look: RodLook | null | undefined, d: RodDraw): { x: number; y: number } {
  const l = look ?? {};
  const shaft = pal(l.color, 'bark');
  const shaft2 = pal(l.shaft2, shaft);
  const pattern = typeof l.pattern === 'string' ? l.pattern : 'solid';
  const grip = typeof l.grip === 'string' && isPaletteName(l.grip) ? l.grip : null;
  const gripLen = grip ? num(l.gripLen, 2) : 0;
  const dir = { x: Math.cos(d.angle), y: Math.sin(d.angle) };
  const perp = { x: -dir.y, y: dir.x };
  const at = (i: number, off = 0) => ({ x: Math.round(d.hx + dir.x * i + perp.x * off), y: Math.round(d.hy + dir.y * i + perp.y * off) });
  const px = (p: { x: number; y: number }, c: PaletteName, a = 1) => {
    g.fillStyle(color(c), a);
    g.fillRect(p.x, p.y, 1, 1);
  };

  for (let i = 0; i <= d.len; i++) {
    let c = shaft;
    if (pattern === 'nodes' && i % 4 === 3) c = shaft2;
    if (pattern === 'alt' && i % 2 === 1) c = shaft2;
    if (pattern === 'facet' && Math.floor(i / 2) % 2 === 1) c = shaft2;
    if (pattern === 'grain' && i % 5 === 2) c = shaft2;
    if (grip && i < gripLen) c = grip;
    px(at(i), c);
    // A thicker grip, and a light stripe down glossy shafts.
    if (grip && i < gripLen) px(at(i, 1), grip);
    if (pattern === 'stripe' && i >= gripLen && i < d.len - 1 && i % 3 !== 0) px(at(i, -1), shaft2, 0.8);
  }

  if (typeof l.reel === 'string' && isPaletteName(l.reel)) {
    const a = at(gripLen + 1, 1);
    px(a, l.reel);
    px({ x: a.x + 1, y: a.y }, l.reel);
    px({ x: a.x, y: a.y + 1 }, l.reel);
    if (l.reelBig === true) px({ x: a.x + 1, y: a.y + 1 }, l.reel);
  }
  const guides = num(l.guides, 0);
  for (let n = 0; n < guides; n++) {
    const i = Math.round(gripLen + 3 + ((d.len - gripLen - 4) * (n + 1)) / (guides + 1));
    px(at(i, 1), 'mist', 0.9);
  }

  const T = at(d.len);
  const tip = pal(l.tip, 'sand');
  // Twinkling tips pulse slowly; reduced motion keeps them still and lit.
  const lit = d.reduced || l.twinkle !== true || Math.sin(d.elapsed / 300) > -0.3;
  if (typeof l.glow === 'string' && isPaletteName(l.glow) && d.dark) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) px({ x: T.x + dx, y: T.y + dy }, l.glow, lit ? 0.45 : 0.15);
  }
  const p = (dx: number, dy: number, c: PaletteName, a = 1) => px({ x: T.x + dx, y: T.y + dy }, c, a);
  switch (l.tipStyle) {
    case 'leaf': {
      const a = at(d.len - 3, -1);
      const b = at(d.len - 6, 1);
      px(a, 'sage');
      px({ x: a.x - 1, y: a.y }, 'moss');
      px(b, 'sage');
      px({ x: b.x + 1, y: b.y }, 'moss');
      p(0, 0, 'sage');
      break;
    }
    case 'branch':
      for (const [i, side] of [[7, -1], [11, 1], [15, -1]] as const) {
        if (i >= d.len) continue;
        px(at(i, side), 'rose');
        px(at(i + 1, side * 2), 'coral');
      }
      p(0, 0, tip);
      break;
    case 'crescent':
      p(0, -1, 'mist');
      p(1, 0, 'mist');
      p(0, 1, 'mist');
      p(-1, -1, tip);
      break;
    case 'shard':
      p(0, 0, 'mist');
      p(0, -1, 'lavender');
      p(1, -1, 'lavender');
      p(1, -2, lit ? 'mist' : 'lavender');
      if (lit && !d.reduced) p(3, -3, 'mist', 0.8);
      break;
    case 'cap':
      p(-1, -1, 'coral');
      p(0, -1, 'gold');
      p(1, -1, 'coral');
      p(0, -2, 'gold');
      p(0, 0, 'sand');
      break;
    case 'star':
      p(0, 0, 'mist');
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) p(dx, dy, 'gold');
      if (lit) for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]] as const) p(dx, dy, 'gold', 0.6);
      break;
    default:
      p(0, 0, tip);
  }
  return T;
}
