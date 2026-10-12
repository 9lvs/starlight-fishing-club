// Canvas painters for the world's parallax layers. Each painter draws one layer
// for one scene palette. Colors are palette-only; soft transitions use ordered
// dithering instead of gradients so the pixel style holds.
import { rgb, type PaletteName, type ScenePalette } from '../../design/tokens';
import { hashString, seededRng } from '../../core/rng';

export const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const;

export function bayer(x: number, y: number): number {
  return BAYER4[y & 3]![x & 3]!;
}

export interface Painter {
  (ctx: CanvasRenderingContext2D, w: number, h: number, pal: ScenePalette, scene: SceneShape): void;
}

export interface SceneShape {
  hills: string;
  foreground: string;
  /** Seed so each water gets its own skyline. */
  seed: number;
  horizonY: number;
}

function fill(ctx: CanvasRenderingContext2D, c: PaletteName): void {
  const [r, g, b] = rgb(c);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: PaletteName): void {
  fill(ctx, c);
  ctx.fillRect(x, y, w, h);
}

/** Bands top to bottom with a dithered blend zone between each pair. */
function bands(ctx: CanvasRenderingContext2D, w: number, y0: number, y1: number, colors: readonly PaletteName[], blend = 6): void {
  const n = colors.length;
  const span = (y1 - y0) / n;
  for (let i = 0; i < n; i++) rect(ctx, 0, Math.round(y0 + i * span), w, Math.ceil(span) + 1, colors[i]!);
  for (let i = 1; i < n; i++) {
    const edge = Math.round(y0 + i * span);
    const upper = colors[i - 1]!;
    for (let y = edge - blend; y < edge + blend; y++) {
      // Fraction of the upper color at this row, as a 0..16 threshold.
      const t = Math.round(((edge + blend - y) / (blend * 2)) * 16);
      fill(ctx, upper);
      for (let x = 0; x < w; x++) if (bayer(x, y) < t) ctx.fillRect(x, y, 1, 1);
    }
  }
}

export const paintSky: Painter = (ctx, w, h, pal, s) => {
  bands(ctx, w, 0, h, pal.skyBands, 10);
  if (s.hills === 'cave') paintCeiling(ctx, w, h, pal, s);
};

/** A rock ceiling with stalactites, for underground waters. */
function paintCeiling(ctx: CanvasRenderingContext2D, w: number, h: number, pal: ScenePalette, s: SceneShape): void {
  const rng = seededRng(s.seed + 5);
  for (let x = 0; x < w; x++) {
    const depth = Math.round(5 + ridge(x, w, s.seed % 13, 3, [2, 5, 9]));
    rect(ctx, x, 0, 1, depth, pal.hillsFar);
  }
  let x = 0;
  while (x < w) {
    const len = 6 + Math.floor(rng() * h * 0.3);
    const half = 1 + Math.floor(rng() * 3);
    for (let y = 0; y < len; y++) {
      const span = Math.max(0, Math.round(half * (1 - y / len)));
      rect(ctx, x - span, y, span * 2 + 1, 1, pal.hillsFar);
    }
    // A glowing drip at some tips.
    if (rng() < 0.4) rect(ctx, x, len, 1, 1, pal.foregroundAccent);
    x += 6 + Math.floor(rng() * 14);
  }
}

/** Periodic in x over the layer width so the layer tiles while drifting. */
function ridge(x: number, w: number, seed: number, amp: number, waves: number[]): number {
  let y = 0;
  waves.forEach((k, i) => {
    y += Math.sin((2 * Math.PI * k * x) / w + seed * (i + 1)) / (i + 1);
  });
  return y * amp;
}

export const paintHillsFar: Painter = (ctx, w, h, pal, s) => {
  if (s.hills === 'none') return;
  const base = h;
  const rng = seededRng(s.seed);
  if (s.hills === 'clouds') {
    paintCloudBank(ctx, w, h, pal.hillsFar, s.seed, 0.45, 5);
    return;
  }
  if (s.hills === 'cave') {
    // A rough rock wall at the back of the cavern, with a few glowing veins.
    for (let x = 0; x < w; x++) {
      const top = Math.round(h * 0.3 + ridge(x, w, s.seed % 7, h * 0.14, [2, 5, 11, 17]));
      rect(ctx, x, top, 1, base - top, pal.hillsFar);
      if (bayer(x, top) < 2) rect(ctx, x, top + 2 + (x % 5), 1, 1, pal.foregroundAccent);
    }
    return;
  }
  if (s.hills === 'cliffs') {
    let x = 0;
    while (x < w) {
      const bw = 6 + Math.floor(rng() * 14);
      const top = Math.round(h * 0.25 + rng() * h * 0.4);
      rect(ctx, x, top, bw, base - top, pal.hillsFar);
      x += bw;
    }
    return;
  }
  for (let x = 0; x < w; x++) {
    const top = Math.round(h * 0.45 + ridge(x, w, s.seed % 7, h * 0.18, [1, 2, 5]));
    rect(ctx, x, top, 1, base - top, pal.hillsFar);
  }
};

/** Puffy cloud tops seen from above, for the sky lake: overlapping round puffs. Tiles across the width. */
function paintCloudBank(ctx: CanvasRenderingContext2D, w: number, h: number, c: PaletteName, seed: number, top: number, maxR: number): void {
  const rng = seededRng(seed + 31);
  const baseY = Math.round(h * top) + maxR;
  rect(ctx, 0, baseY, w, h - baseY, c);
  let x = 0;
  while (x < w + maxR) {
    const r = Math.max(2, Math.round(maxR * (0.5 + rng() * 0.8)));
    for (let dy = -r; dy <= 0; dy++) {
      const half = Math.round(Math.sqrt(r * r - dy * dy) * 1.3);
      for (let dx = -half; dx <= half; dx++) rect(ctx, (x + dx + w) % w, baseY + dy, 1, 1, c);
    }
    x += Math.max(3, Math.round(r * 1.6));
  }
}

export const paintHillsNear: Painter = (ctx, w, h, pal, s) => {
  if (s.hills === 'none') return;
  const rng = seededRng(s.seed + 11);
  if (s.hills === 'clouds') {
    paintCloudBank(ctx, w, h, pal.hillsNear, s.seed + 3, 0.6, 6);
    return;
  }
  if (s.hills === 'cave') {
    // Low rocks along the shore with glowing mushrooms.
    for (let x = 0; x < w; x++) {
      const top = Math.round(h * 0.78 + ridge(x, w, s.seed % 5, h * 0.06, [4, 9]));
      rect(ctx, x, top, 1, h - top, pal.hillsNear);
    }
    for (let i = 0; i < Math.floor(w / 18); i++) {
      const cx = Math.floor(rng() * w);
      const top = Math.round(h * 0.78 + ridge(cx, w, s.seed % 5, h * 0.06, [4, 9]));
      rect(ctx, cx, top - 2, 1, 2, pal.hillsNear);
      rect(ctx, cx - 1, top - 3, 3, 1, pal.foregroundAccent);
    }
    return;
  }
  if (s.hills === 'pines') {
    for (let x = 0; x < w; x++) {
      const top = Math.round(h * 0.7 + ridge(x, w, s.seed % 5, h * 0.08, [2, 3]));
      rect(ctx, x, top, 1, h - top, pal.hillsNear);
    }
    for (let i = 0; i < Math.floor(w / 7); i++) {
      const cx = Math.floor(rng() * w);
      const ph = 8 + Math.floor(rng() * 12);
      const baseY = Math.round(h * 0.72);
      for (let j = 0; j < ph; j++) {
        const half = Math.floor((j / ph) * 4);
        for (let dx = -half; dx <= half; dx++) rect(ctx, (cx + dx + w) % w, baseY - ph + j, 1, 1, pal.hillsNear);
      }
    }
    return;
  }
  if (s.hills === 'cliffs') {
    for (let x = 0; x < w; x++) {
      const top = Math.round(h * 0.75 + ridge(x, w, s.seed % 3, h * 0.06, [3, 7]));
      rect(ctx, x, top, 1, h - top, pal.hillsNear);
    }
    return;
  }
  for (let x = 0; x < w; x++) {
    const top = Math.round(h * 0.68 + ridge(x, w, (s.seed % 11) + 2, h * 0.12, [1, 3]));
    rect(ctx, x, top, 1, h - top, pal.hillsNear);
  }
  // A few rounded trees on rolling hills.
  for (let i = 0; i < Math.floor(w / 30); i++) {
    const cx = Math.floor(rng() * w);
    const top = Math.round(h * 0.68 + ridge(cx, w, (s.seed % 11) + 2, h * 0.12, [1, 3]));
    for (let dy = -4; dy <= 0; dy++) {
      const half = dy === -4 ? 1 : dy === 0 ? 2 : 3;
      rect(ctx, (cx - half + w) % w, top - 3 + dy, half * 2 + 1, 1, pal.hillsNear);
    }
  }
};

export const paintClouds: Painter = (ctx, w, h, pal, s) => {
  if (s.hills === 'cave') return;
  const rng = seededRng(s.seed + 23);
  const count = Math.max(2, Math.floor(w / 45));
  for (let i = 0; i < count; i++) {
    const cx = Math.floor(rng() * w);
    const cy = Math.floor(h * 0.2 + rng() * h * 0.6);
    const len = 14 + Math.floor(rng() * 22);
    for (let p = 0; p < 4; p++) {
      const px = cx + Math.floor((p / 3) * len) - Math.floor(len / 2);
      const r = 2 + Math.floor(rng() * 4);
      for (let y = -r; y <= Math.floor(r / 2); y++) {
        const half = Math.round(Math.sqrt(Math.max(0, r * r - y * y)) * 1.6);
        for (let x = -half; x <= half; x++) rect(ctx, (px + x + w) % w, cy + y, 1, 1, pal.clouds);
      }
    }
    // Flat underside line in the lighter tone of the sky.
    rect(ctx, cx - Math.floor(len / 2), cy + 1, len, 1, pal.skyBands[pal.skyBands.length - 1]!);
  }
};

export const paintWater: Painter = (ctx, w, h, pal, s) => {
  // h is the water height; top rows reflect the sky.
  rect(ctx, 0, 0, w, h, pal.waterDeep);
  // A thin band of reflected sky at the far shore, dithered into deep water.
  const topBand = 3;
  const fade = 16;
  rect(ctx, 0, 0, w, topBand, pal.waterTop);
  for (let y = topBand; y < topBand + fade; y++) {
    const t = Math.round(((topBand + fade - y) / fade) * 15);
    fill(ctx, pal.waterTop);
    for (let x = 0; x < w; x++) if (bayer(x, y) < t) ctx.fillRect(x, y, 1, 1);
  }
  rect(ctx, 0, 0, w, 1, pal.waterShine);
  // Static shine streaks, longer near the viewer for depth.
  const rng = seededRng(s.seed + 41);
  // Few and soft: bright streaks everywhere tire the eyes.
  const streaks = Math.floor((w * h) / 1600);
  for (let i = 0; i < streaks; i++) {
    const y = Math.floor(rng() * h);
    const len = 2 + Math.floor((y / h) * 8 * rng());
    const x = Math.floor(rng() * w);
    rect(ctx, x, y, len, 1, y < topBand ? pal.waterShine : pal.waterTop);
  }
};

export const paintForeground: Painter = (ctx, w, h, pal, s) => {
  const rng = seededRng(s.seed + 97);
  if (s.foreground === 'none') return;
  const clusters = [
    { x: 0, span: Math.round(w * 0.22) },
    { x: Math.round(w * 0.82), span: Math.round(w * 0.18) },
  ];
  for (const c of clusters) {
    if (s.foreground === 'reeds') {
      for (let i = 0; i < c.span / 2; i++) {
        const x = c.x + Math.floor(rng() * c.span);
        const tall = Math.floor(h * 0.35 + rng() * h * 0.55);
        const lean = rng() < 0.5 ? -1 : 1;
        for (let y = 0; y < tall; y++) rect(ctx, x + (y > tall * 0.7 ? lean : 0), h - y, 1, 1, pal.foreground);
        if (rng() < 0.35) rect(ctx, x + lean, h - tall - 3, 1, 3, pal.foregroundAccent);
      }
    } else if (s.foreground === 'rocks') {
      for (let i = 0; i < 3; i++) {
        const cx = c.x + Math.floor(rng() * c.span);
        const r = 4 + Math.floor(rng() * 7);
        for (let y = -r; y <= 0; y++) {
          const half = Math.round(Math.sqrt(r * r - y * y) * 1.4);
          rect(ctx, cx - half, h + y, half * 2 + 1, 1, y < -r + 2 ? pal.foregroundAccent : pal.foreground);
        }
      }
    } else if (s.foreground === 'crystals') {
      for (let i = 0; i < 4; i++) {
        const cx = c.x + Math.floor(rng() * c.span);
        const tall = 6 + Math.floor(rng() * h * 0.5);
        const lean = rng() < 0.5 ? -1 : 1;
        for (let y = 0; y < tall; y++) {
          const half = Math.max(0, Math.round(2 * (1 - y / tall)));
          const x = cx + Math.round((y / tall) * lean * 2);
          rect(ctx, x - half, h - y, half * 2 + 1, 1, y > tall - 3 ? pal.foregroundAccent : pal.foreground);
        }
      }
    } else if (s.foreground === 'lilies') {
      for (let i = 0; i < 4; i++) {
        const cx = c.x + Math.floor(rng() * c.span);
        const cy = h - 2 - Math.floor(rng() * h * 0.5);
        rect(ctx, cx - 3, cy, 7, 2, pal.foreground);
        rect(ctx, cx - 2, cy - 1, 5, 1, pal.foregroundAccent);
        if (rng() < 0.5) rect(ctx, cx, cy - 2, 1, 1, 'rose');
      }
    }
  }
};

export function sceneSeed(waterId: string): number {
  return hashString(waterId) % 10000;
}
