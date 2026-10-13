// Landmarks: the buildings and props that give each water its own place, from
// a tool shed on the pond to a domed clubhouse above the clouds. They are
// painted on one layer that sits on the far shore and drifts with the near
// hills. Colors come from the scene palette (wall, roof, window, lamp), so they
// change with the time of day and windows light up at night.
import type { PaletteName, ScenePalette } from '../../design/tokens';
import { bayer, rect, type Painter, type SceneShape } from './painters';

/** Height of the landmark layer; its bottom 3 rows overlap the water's edge. */
export const LANDMARK_LAYER_H = 72;
const SINK = 3;

/** The club's own flag, the same in every water. */
const PENNANT: PaletteName = 'coral';

/** Points that moving effects attach to, in landmark layer pixels. */
export interface LandmarkAnchors {
  chimney?: { x: number; y: number };
  lamp?: { x: number; y: number };
  falls?: { x: number; y: number };
  canopies: { x: number; y: number }[];
}

interface Placed {
  draw: (ctx: CanvasRenderingContext2D, x: number, base: number, pal: ScenePalette, w: number) => void;
  /** Where it stands, as a share of the layer width. */
  at: number;
  anchors?: (x: number, base: number, a: LandmarkAnchors) => void;
}

const isNight = (pal: ScenePalette) => pal.celestialKind === 'moon';

function pennant(ctx: CanvasRenderingContext2D, x: number, top: number, pal: ScenePalette): void {
  rect(ctx, x, top, 1, 6, pal.wallShade);
  rect(ctx, x + 1, top, 4, 1, PENNANT);
  rect(ctx, x + 1, top + 1, 3, 1, PENNANT);
  rect(ctx, x + 1, top + 2, 1, 1, PENNANT);
}

/** A pitched roof: a triangle with a one pixel overhang each side. */
function roof(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, c: PaletteName): number {
  const rise = Math.ceil((w + 2) / 4);
  for (let i = 0; i < rise; i++) rect(ctx, x - 1 + i * 2, y - i, w + 2 - i * 4, 1, c);
  return y - rise;
}

function willow(ctx: CanvasRenderingContext2D, x: number, base: number, pal: ScenePalette): void {
  rect(ctx, x, base - 12, 2, 12, pal.wallShade);
  const cy = base - 16;
  for (let dy = -7; dy <= 3; dy++) {
    const half = Math.round(Math.sqrt(Math.max(0, 64 - dy * dy)) * 1.3);
    rect(ctx, x + 1 - half, cy + dy, half * 2, 1, pal.foreground);
  }
  // Long drooping strands, the willow's whole character.
  for (let sx = -9; sx <= 10; sx += 2) {
    const len = 6 + ((sx * 7 + 20) % 7);
    rect(ctx, x + sx, cy + 2, 1, len, sx % 4 === 0 ? pal.foregroundAccent : pal.foreground);
  }
}

function palm(ctx: CanvasRenderingContext2D, x: number, base: number, pal: ScenePalette, lean: number): void {
  // A little sandbar, then a curved trunk and drooping fronds.
  for (let dy = 0; dy < 3; dy++) rect(ctx, x - 9 + dy * 2, base - dy, 20 - dy * 4, 1, 'sand');
  let tx = x;
  for (let y = 0; y < 16; y++) {
    if (y % 5 === 4) tx += lean;
    rect(ctx, tx, base - 3 - y, 2, 1, y % 3 === 0 ? pal.wallShade : pal.wall === 'sand' ? 'bark' : pal.wallShade);
  }
  const top = base - 19;
  for (const [dx, dir] of [[-1, -1], [2, 1], [0, -1], [1, 1]] as const) {
    for (let i = 0; i < 7; i++) rect(ctx, tx + dx + dir * i, top + Math.floor((i * i) / 10) + (dx === 0 || dx === 1 ? -1 : 0), 1, 1, i > 4 ? pal.foregroundAccent : pal.foreground);
  }
}

const PAINTERS: Record<string, Placed[]> = {
  willows: [
    { at: 0.1, draw: (c, x, b, p) => willow(c, x, b - 1, p), anchors: (x, b, a) => a.canopies.push({ x, y: b - 17 }) },
    { at: 0.88, draw: (c, x, b, p) => willow(c, x, b - 1, p), anchors: (x, b, a) => a.canopies.push({ x, y: b - 17 }) },
  ],
  shed: [
    {
      at: 0.7,
      draw: (c, x, b, p) => {
        // The club's first home: a tool shed with a hand-made flag.
        rect(c, x, b - 9, 12, 8, p.wall);
        rect(c, x + 9, b - 9, 3, 8, p.wallShade);
        rect(c, x + 2, b - 6, 3, 5, p.wallShade);
        rect(c, x + 6, b - 7, 2, 2, p.window);
        const top = roof(c, x, b - 10, 12, p.roof);
        pennant(c, x + 6, top - 5, p);
      },
    },
  ],
  jetty: [
    {
      at: 0.7,
      draw: (c, x, b, p) => {
        rect(c, x - 3, b - 1, 26, 1, p.wallShade);
        rect(c, x - 3, b - 2, 26, 1, p.wall === 'sand' ? 'bark' : p.wallShade);
        for (let px = x - 2; px < x + 23; px += 5) rect(c, px, b, 1, SINK, p.wallShade);
      },
    },
  ],
  cabin: [
    {
      at: 0.28,
      draw: (c, x, b, p) => {
        // A log cabin: alternating log rows, a stone chimney, a lit window at night.
        for (let y = 0; y < 11; y++) rect(c, x, b - 2 - y, 20, 1, y % 2 === 0 ? p.wallShade : p.wall === 'sand' ? 'bark' : p.wallShade);
        rect(c, x + 14, b - 11, 5, 9, p.wallShade);
        rect(c, x + 3, b - 9, 4, 4, p.window);
        rect(c, x + 5, b - 9, 1, 4, p.wallShade);
        rect(c, x + 9, b - 8, 3, 6, p.wallShade);
        rect(c, x + 15, b - 21, 3, 8, 'slate');
        roof(c, x, b - 13, 20, p.roof);
        pennant(c, x + 3, b - 26, p);
      },
      anchors: (x, b, a) => (a.chimney = { x: x + 16, y: b - 22 }),
    },
  ],
  dock: [
    {
      at: 0.28,
      draw: (c, x, b, p) => {
        rect(c, x - 4, b - 2, 34, 2, p.wallShade);
        for (let px = x - 3; px < x + 30; px += 6) rect(c, px, b, 1, SINK, p.wallShade);
        // A rowboat tied up at the end.
        rect(c, x + 24, b, 9, 1, p.wallShade);
        rect(c, x + 25, b + 1, 7, 1, p.wallShade);
      },
    },
  ],
  lighthouse: [
    {
      at: 0.86,
      draw: (c, x, b, p) => {
        // On a rocky point: a striped tower and a lantern room that lights at dusk.
        for (let dy = 0; dy < 8; dy++) rect(c, x - 12 + dy, b - dy, 26 - dy * 2, 1, p.hillsNear);
        for (let y = 0; y < 30; y++) {
          const half = 4 - Math.floor(y / 10);
          const band = Math.floor(y / 5) % 2 === 0 ? p.wall : isNight(p) ? p.wallShade : 'coral';
          rect(c, x - half, b - 8 - y, half * 2 + 1, 1, band);
          rect(c, x + half, b - 8 - y, 1, 1, p.wallShade);
        }
        rect(c, x - 3, b - 39, 7, 1, p.wallShade);
        rect(c, x - 2, b - 43, 5, 4, p.lamp);
        rect(c, x, b - 43, 1, 4, p.wallShade);
        rect(c, x - 2, b - 44, 5, 1, p.roof);
        rect(c, x - 1, b - 45, 3, 1, p.roof);
        rect(c, x, b - 47, 1, 2, p.wallShade);
      },
      anchors: (x, b, a) => (a.lamp = { x, y: b - 41 }),
    },
  ],
  harbor: [
    {
      at: 0.1,
      draw: (c, x, b, p, w) => {
        // A stone quay with bollards, and a row of harbor houses behind it.
        const len = Math.round(w * 0.5);
        rect(c, x - 6, b - 3, len, 3, p.hillsFar);
        for (let i = 0; i < len; i += 2) if (bayer(i, 0) < 8) rect(c, x - 6 + i, b - 2, 1, 1, p.wallShade);
        for (let bx = x - 2; bx < x - 6 + len; bx += 11) rect(c, bx, b - 5, 2, 2, p.wallShade);
        const houses = [
          [9, 10],
          [7, 14],
          [10, 9],
          [8, 12],
          [9, 16],
          [7, 10],
        ] as const;
        let hx = x;
        for (const [hw, hh] of houses) {
          if (hx + hw > x - 6 + len - 2) break;
          rect(c, hx, b - 3 - hh, hw, hh, p.wall);
          rect(c, hx + hw - 2, b - 3 - hh, 2, hh, p.wallShade);
          for (let wy = b - hh; wy < b - 5; wy += 4) for (let wx = hx + 1; wx < hx + hw - 3; wx += 3) rect(c, wx, wy, 1, 2, p.window);
          roof(c, hx, b - 4 - hh, hw, hx % 2 === 0 ? p.roof : p.wallShade);
          hx += hw + 1;
        }
        pennant(c, x + 18, b - 27, p);
      },
    },
  ],
  moored_boats: [
    {
      at: 0.56,
      draw: (c, x, b, p) => {
        for (const [dx, mast] of [
          [0, 15],
          [14, 19],
        ] as const) {
          rect(c, x + dx, b, 10, 1, p.wallShade);
          rect(c, x + dx + 1, b + 1, 8, 1, p.wallShade);
          rect(c, x + dx + 4, b - mast, 1, mast, p.wallShade);
          rect(c, x + dx + 2, b - 3, 6, 1, p.wall);
          rect(c, x + dx + 5, b - mast + 1, 2, 1, PENNANT);
        }
      },
    },
  ],
  palms: [
    { at: 0.1, draw: (c, x, b, p) => palm(c, x, b, p, 1), anchors: (x, b, a) => a.canopies.push({ x, y: b - 19 }) },
    { at: 0.9, draw: (c, x, b, p) => palm(c, x, b, p, -1), anchors: (x, b, a) => a.canopies.push({ x, y: b - 19 }) },
  ],
  bungalows: [
    {
      at: 0.6,
      draw: (c, x, b, p) => {
        // Overwater bungalows on stilts, joined by a boardwalk: the resort.
        rect(c, x - 2, b - 3, 42, 1, p.wallShade);
        for (let px = x; px < x + 40; px += 4) rect(c, px, b - 2, 1, 2 + SINK, p.wallShade);
        for (const hx of [x, x + 15, x + 30]) {
          rect(c, hx, b - 10, 9, 7, p.wall);
          rect(c, hx + 7, b - 10, 2, 7, p.wallShade);
          rect(c, hx + 3, b - 8, 2, 2, p.window);
          // Thatch: a steep roof with a dithered texture.
          for (let i = 0; i < 5; i++) {
            const y = b - 11 - i;
            const x0 = hx - 2 + i;
            const len = 13 - i * 2;
            for (let k = 0; k < len; k++) rect(c, x0 + k, y, 1, 1, bayer(x0 + k, y) < 9 ? p.roof : p.wallShade);
          }
        }
        pennant(c, x + 19, b - 22, p);
      },
    },
  ],
  coral: [],
  grotto: [
    {
      at: 0.72,
      draw: (c, x, b, p) => {
        // A carved stone arch with a warm, lit doorway and steps to the water.
        for (let y = 0; y < 22; y++) {
          const half = y < 16 ? 9 : Math.round(Math.sqrt(Math.max(0, 81 - (y - 16) ** 2 * 3)));
          rect(c, x - half, b - 2 - y, half * 2 + 1, 1, p.wall);
        }
        for (let y = 0; y < 15; y++) {
          const half = y < 10 ? 4 : Math.round(Math.sqrt(Math.max(0, 16 - (y - 10) ** 2)));
          rect(c, x - half, b - 2 - y, half * 2 + 1, 1, p.window);
        }
        for (let s = 0; s < 3; s++) rect(c, x - 6 - s * 2, b - 1 + s - 2, 13 + s * 4, 1, p.wallShade);
        for (const lx of [x - 13, x + 12]) {
          rect(c, lx, b - 12, 1, 10, p.wallShade);
          rect(c, lx - 1, b - 15, 3, 3, p.lamp);
        }
        pennant(c, x, b - 30, p);
      },
    },
  ],
  lantern_string: [
    {
      at: 0.05,
      draw: (c, x, _b, p, w) => {
        const len = Math.round(w * 0.9);
        for (let i = 0; i <= len; i++) {
          const sag = Math.round(Math.sin((i / len) * Math.PI) * 9);
          rect(c, x + i, 6 + sag, 1, 1, p.wallShade);
          if (i % 14 === 7) {
            rect(c, x + i, 7 + sag, 1, 1, p.wallShade);
            rect(c, x + i - 1, 8 + sag, 3, 3, p.lamp);
          }
        }
      },
    },
  ],
  pavilion: [
    {
      at: 0.76,
      draw: (c, x, b, p) => {
        // A floating island with the grand clubhouse: columns and a gold dome.
        const top = b - 30;
        for (let dy = 0; dy < 14; dy++) {
          const half = Math.max(0, 18 - Math.round(dy * 1.4));
          rect(c, x - half, top + dy, half * 2 + 1, 1, dy < 2 ? p.foregroundAccent : p.hillsNear);
        }
        for (const rx of [x - 9, x - 2, x + 6]) rect(c, rx, top + 14, 1, 3 + ((rx + 20) % 4), p.hillsNear);
        rect(c, x - 11, top - 2, 23, 2, p.wall);
        for (let cx = x - 10; cx <= x + 10; cx += 4) rect(c, cx, top - 12, 2, 10, p.wall);
        for (let cx = x - 8; cx <= x + 8; cx += 4) rect(c, cx, top - 10, 2, 7, p.window);
        rect(c, x - 11, top - 14, 23, 2, p.wallShade);
        for (let dy = 0; dy < 7; dy++) {
          const half = Math.round(Math.sqrt(Math.max(0, 49 - dy * dy)) * 1.3);
          rect(c, x - half, top - 15 - dy, half * 2 + 1, 1, p.roof);
        }
        rect(c, x - 3, top - 20, 2, 1, p.lamp);
        pennant(c, x, top - 28, p);
      },
      anchors: (x, b, a) => (a.falls = { x: x + 12, y: b - 22 }),
    },
  ],
  floating_isles: [
    {
      at: 0.2,
      draw: (c, x, b, p) => {
        for (const [dx, dy, r] of [
          [0, -44, 6],
          [22, -36, 4],
        ] as const) {
          for (let k = 0; k < r + 2; k++) {
            const half = Math.max(0, r - k);
            rect(c, x + dx - half, b + dy + k, half * 2 + 1, 1, k === 0 ? p.foregroundAccent : p.hillsNear);
          }
          rect(c, x + dx - 1, b + dy - 4, 1, 4, p.wallShade);
          rect(c, x + dx - 3, b + dy - 7, 5, 3, p.foreground);
        }
      },
    },
  ],
};

export const paintLandmarks: Painter = (ctx, w, h, pal, s) => {
  const base = h - SINK;
  for (const id of s.landmarks) for (const p of PAINTERS[id] ?? []) p.draw(ctx, Math.round(w * p.at), base, pal, w);
};

export function landmarkAnchors(s: SceneShape, w: number): LandmarkAnchors {
  const a: LandmarkAnchors = { canopies: [] };
  const base = LANDMARK_LAYER_H - SINK;
  for (const id of s.landmarks) for (const p of PAINTERS[id] ?? []) p.anchors?.(Math.round(w * p.at), base, a);
  return a;
}

/** Coral heads under the surface: dithered so they read as seen through water. */
export function paintCoral(ctx: CanvasRenderingContext2D, w: number, h: number, pal: ScenePalette, seed: number): void {
  const night = isNight(pal);
  const tones: PaletteName[] = night ? ['plum', 'dusk', 'midnight'] : ['coral', 'rose', 'lavender', 'sage'];
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const count = Math.floor(w / 14);
  for (let i = 0; i < count; i++) {
    const cx = Math.floor(rnd() * w);
    const cy = Math.floor(14 + rnd() * (h - 40));
    // Keep the water around the boat clear.
    if (Math.abs(cx - w / 2) < 26 && cy > h * 0.35) continue;
    const r = 2 + Math.floor(rnd() * 3 + (cy / h) * 3);
    const tone = tones[i % tones.length]!;
    for (let dy = -r; dy <= 0; dy++) {
      const half = Math.round(Math.sqrt(r * r - dy * dy) * 1.4);
      for (let dx = -half; dx <= half; dx++) if (bayer(cx + dx, cy + dy) < 9) rect(ctx, cx + dx, cy + dy, 1, 1, tone);
    }
    // A branching tip or two.
    if (rnd() < 0.6) rect(ctx, cx - 1, cy - r - 2, 1, 2, tone);
    if (rnd() < 0.6) rect(ctx, cx + 2, cy - r - 1, 1, 2, tone);
  }
}
