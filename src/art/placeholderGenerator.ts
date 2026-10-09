// Procedural placeholder sprites drawn from the palette. They are meant to be
// charming enough to play with, and to be replaced one by one with real art
// (see docs/SPRITES.md). Every function draws into a horizontal sprite strip.
import type { PaletteName } from '../design/tokens';
import { hashString, seededRng } from '../core/rng';
import { FrameCanvas, PixelCanvas, SHADE_DOWN, SHADE_UP } from './pixelCanvas';
import type { SpriteEntry } from './spriteManifest';

export interface FishArtHint {
  body?: PaletteName;
  accent?: PaletteName;
  shape?: string;
}

export interface PlaceholderHints {
  fish: Map<string, FishArtHint>;
  water: Map<string, { hills: string; foreground: string }>;
}

/** Where the fisher's hand is in each frame, for attaching the rod. */
export const FISHER_HAND: readonly { x: number; y: number }[] = [
  { x: 11, y: 12 },
  { x: 11, y: 13 },
  { x: 13, y: 9 },
  { x: 12, y: 7 },
];

export function generatePlaceholder(entry: SpriteEntry, hints: PlaceholderHints): HTMLCanvasElement {
  const sheet = new PixelCanvas(entry.width * entry.frames, entry.height);
  for (let i = 0; i < entry.frames; i++) {
    const f = sheet.frame(i, entry.width);
    switch (entry.kind) {
      case 'fish':
        drawFish(f, entry.key, hints.fish.get(entry.key) ?? {});
        break;
      case 'boat':
        drawBoat(f);
        break;
      case 'fisher':
        drawFisher(f, i);
        break;
      case 'bobber':
        drawBobber(f, i);
        break;
      case 'crew':
        drawCrew(f, entry.key, i);
        break;
      case 'water':
        drawWater(f, entry.key, hints.water.get(entry.key));
        break;
      case 'decor':
        drawDecor(f, entry.key);
        break;
      case 'fx':
        drawFx(f, entry.key, i);
        break;
      case 'icon':
        drawIcon(f, entry.key.replace(/^icon_/, ''));
        break;
    }
  }
  return sheet.canvas;
}

// ---------------------------------------------------------------- fish

const FISH_BODIES: PaletteName[] = ['slate', 'sage', 'sand', 'coral', 'sky', 'lavender', 'moss', 'gold', 'rose'];
const FISH_SHAPES = ['slim', 'round', 'long', 'tiny'];
const DARK_BODIES = new Set<PaletteName>(['midnight', 'plum', 'bark', 'moss', 'dusk', 'teal', 'ink']);

function drawFish(f: FrameCanvas, key: string, hint: FishArtHint): void {
  const h = hashString(key);
  const rng = seededRng(h);
  const body = hint.body ?? FISH_BODIES[h % FISH_BODIES.length]!;
  const accent = hint.accent ?? SHADE_UP[body];
  const shape = hint.shape ?? FISH_SHAPES[(h >>> 4) % FISH_SHAPES.length]!;
  const light = SHADE_UP[body];
  const dark = SHADE_DOWN[body];

  if (shape === 'ray') {
    f.line(1, 9, 4, 8, accent);
    f.poly([[3, 8], [8.5, 3.5], [14.5, 8], [8.5, 12.5]], body);
    for (let y = 9; y < 13; y++) for (let x = 0; x < 16; x++) if (f.get(x, y) === body) f.px(x, y, light);
    f.px(6, 7, accent);
    f.px(11, 7, accent);
    f.px(9, 6, accent);
    f.outline((n) => SHADE_DOWN[n]);
    f.px(12, 7, DARK_BODIES.has(body) ? 'mist' : 'ink');
    return;
  }
  if (shape === 'eel') {
    for (let x = 1; x <= 13; x++) {
      const y = 8 + Math.round(Math.sin(x * 0.75) * 1.6);
      f.px(x, y, body);
      f.px(x, y + 1, x > 3 ? light : body);
      if (x > 9) f.px(x, y - 1, body);
    }
    f.px(14, 8 + Math.round(Math.sin(13 * 0.75) * 1.6), body);
    f.outline((n) => SHADE_DOWN[n]);
    f.px(13, 7 + Math.round(Math.sin(13 * 0.75) * 1.6), DARK_BODIES.has(body) ? 'mist' : 'ink');
    return;
  }

  const P: Record<string, { cx: number; cy: number; rx: number; ry: number; tail: number }> = {
    tiny: { cx: 9, cy: 8, rx: 3.6, ry: 2.3, tail: 2 },
    slim: { cx: 9, cy: 8, rx: 5, ry: 2.7, tail: 3 },
    round: { cx: 9, cy: 8, rx: 4.6, ry: 3.9, tail: 3 },
    long: { cx: 9, cy: 8, rx: 6.2, ry: 2.4, tail: 2.5 },
    whale: { cx: 8.6, cy: 8.5, rx: 6.2, ry: 4.4, tail: 2.5 },
    puffer: { cx: 8.5, cy: 8, rx: 4.4, ry: 4.4, tail: 2 },
  };
  const p = P[shape] ?? P.slim!;
  const back = p.cx - p.rx;

  // Tail behind the body.
  if (shape === 'whale') {
    f.poly([[back + 1, p.cy], [back - 2.5, p.cy - 3.5], [back - 1, p.cy], [back - 2.5, p.cy + 1.5]], accent);
  } else {
    f.poly([[back + 1, p.cy], [back - p.tail, p.cy - p.tail], [back - p.tail + 1, p.cy], [back - p.tail, p.cy + p.tail]], accent);
  }
  // Dorsal fin.
  if (shape !== 'whale' && shape !== 'puffer') {
    f.poly([[p.cx - 2, p.cy - p.ry + 0.6], [p.cx - 0.5, p.cy - p.ry - 1.6], [p.cx + 1.5, p.cy - p.ry + 0.6]], accent);
  }
  f.ellipse(p.cx, p.cy, p.rx, p.ry, body);
  // Lighter belly.
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (f.get(x, y) !== body) continue;
      const dy = (y + 0.5 - p.cy) / p.ry;
      if (dy > 0.35) f.px(x, y, light);
    }
  }
  // Pattern.
  const pattern = (h >>> 9) % 3;
  if (shape === 'whale') {
    for (let i = 0; i < 5; i++) {
      const x = Math.round(p.cx - 3 + rng() * 6);
      const y = Math.round(p.cy - 3 + rng() * 2);
      if (f.get(x, y) === body) f.px(x, y, accent);
    }
  } else if (pattern === 1) {
    for (const sx of [Math.round(p.cx - 2), Math.round(p.cx + 1)]) {
      for (let y = 0; y < 16; y++) if (f.get(sx, y) === body) f.px(sx, y, dark);
    }
  } else if (pattern === 2) {
    for (let i = 0; i < 4; i++) {
      const x = Math.round(p.cx - p.rx + 2 + rng() * (p.rx * 1.4));
      const y = Math.round(p.cy - p.ry + 1 + rng() * p.ry);
      if (f.get(x, y) === body) f.px(x, y, accent);
    }
  }
  if (shape === 'puffer') {
    for (const [x, y] of [[8, 2], [13, 4], [14, 9], [4, 4], [3, 10], [8, 14], [12, 13]] as [number, number][]) f.px(x, y, accent);
  }
  f.outline((n) => SHADE_DOWN[n]);
  // Eye and a little gill line.
  const ex = Math.round(p.cx + p.rx * 0.55);
  const ey = Math.round(p.cy - p.ry * 0.3);
  f.px(ex, ey, DARK_BODIES.has(body) ? 'mist' : 'ink');
  if (shape !== 'whale' && shape !== 'tiny') f.px(ex - 2, ey + 1, dark);
}

// ---------------------------------------------------------------- boat and fisher

function drawBoat(f: FrameCanvas): void {
  // Mast first so the hull overlaps its foot.
  f.rect(17, 3, 1, 17, 'bark');
  f.poly([[1, 19], [28, 17.5], [31, 15.5], [27, 26], [6, 26]], 'bark');
  for (let x = 0; x < 32; x++) {
    for (let y = 24; y < 27; y++) if (f.get(x, y) === 'bark') f.px(x, y, 'plum');
  }
  f.line(2, 20, 28, 18, 'sand');
  f.line(5, 23, 27, 22, 'sand');
  f.outline((n) => SHADE_DOWN[n]);
  // Little seat and oarlock.
  f.rect(8, 18, 4, 1, 'sand');
  f.px(22, 17, 'gold');
}

function drawFisher(f: FrameCanvas, frame: number): void {
  const bob = frame === 1 ? 1 : 0;
  // Coat and legs.
  f.rect(6, 17, 4, 5, 'dusk');
  f.rect(6, 22, 4, 2, 'bark');
  f.rect(5, 8 + bob, 6, 9 - bob, 'coral');
  f.rect(6, 8 + bob, 4, 1, 'gold'); // collar
  // Head and hat.
  f.rect(6, 4 + bob, 4, 4, 'sand');
  f.rect(4, 3 + bob, 8, 1, 'gold');
  f.rect(6, 1 + bob, 4, 2, 'gold');
  // Arm per pose.
  if (frame === 2) {
    f.rect(10, 9 + bob, 3, 1, 'coral');
    f.px(13, 9, 'sand');
  } else if (frame === 3) {
    f.rect(11, 8, 1, 3, 'coral');
    f.px(12, 7, 'sand');
  } else {
    f.rect(10, 10 + bob, 1, 3, 'coral');
    f.px(11, 12 + bob, 'sand');
  }
  f.outline((n) => SHADE_DOWN[n]);
  f.px(8, 5 + bob, 'ink'); // eye
  f.px(9, 6 + bob, 'rose'); // cheek
}

function drawBobber(f: FrameCanvas, frame: number): void {
  const dy = frame === 1 ? 2 : 0;
  f.rect(4, 1 + dy, 1, 2, 'coral');
  f.ellipse(4.5, 4.5 + dy, 2.2, 2.2, 'coral');
  for (let y = 5 + dy; y < 8; y++) for (let x = 0; x < 8; x++) if (f.get(x, y) === 'coral') f.px(x, y, 'mist');
  if (frame === 1) for (let x = 0; x < 8; x++) f.px(x, 7, null);
}

const CREW_LOOKS: Record<string, { hat: PaletteName; coat: PaletteName; beard?: boolean; otter?: boolean }> = {
  crew_deckhand: { hat: 'sky', coat: 'sage' },
  crew_old_salt: { hat: 'bark', coat: 'dusk', beard: true },
  crew_otter: { hat: 'bark', coat: 'bark', otter: true },
};

function drawCrew(f: FrameCanvas, key: string, frame: number): void {
  const h = hashString(key);
  const look = CREW_LOOKS[key] ?? {
    hat: FISH_BODIES[h % FISH_BODIES.length]!,
    coat: FISH_BODIES[(h >>> 5) % FISH_BODIES.length]!,
  };
  const bob = frame === 1 ? 1 : 0;
  if (look.otter) {
    f.ellipse(8, 16, 4.5, 6, 'bark');
    f.ellipse(8, 8 + bob, 3.6, 3.2, 'bark');
    f.ellipse(8, 18, 2.5, 3.5, 'sand');
    f.rect(6, 9 + bob, 4, 2, 'sand');
    f.px(5, 5 + bob, 'bark');
    f.px(11, 5 + bob, 'bark');
    f.line(12, 21, 15, 19, 'bark');
    f.outline((n) => SHADE_DOWN[n]);
    f.px(7, 8 + bob, 'ink');
    f.px(9, 8 + bob, 'ink');
    f.px(8, 9 + bob, 'ink');
    return;
  }
  f.rect(6, 17, 4, 5, 'midnight');
  f.rect(6, 22, 4, 2, 'bark');
  f.rect(5, 9 + bob, 6, 8 - bob, look.coat);
  f.rect(6, 5 + bob, 4, 4, 'sand');
  f.rect(5, 4 + bob, 6, 1, look.hat);
  f.rect(6, 2 + bob, 4, 2, look.hat);
  if (look.beard) f.rect(6, 8 + bob, 4, 2, 'mist');
  f.outline((n) => SHADE_DOWN[n]);
  f.px(7, 6 + bob, 'ink');
  f.px(9, 6 + bob, 'ink');
}

// ---------------------------------------------------------------- map icons and decor

function drawWater(f: FrameCanvas, key: string, scene?: { hills: string; foreground: string }): void {
  const looks: Record<string, { sky: PaletteName; hill: PaletteName; water: PaletteName; extra: string }> = {
    water_pond: { sky: 'sky', hill: 'moss', water: 'teal', extra: 'reeds' },
    water_river: { sky: 'lavender', hill: 'moss', water: 'dusk', extra: 'pines' },
    water_cove: { sky: 'midnight', hill: 'plum', water: 'dusk', extra: 'moon' },
    water_cave: { sky: 'ink', hill: 'plum', water: 'midnight', extra: 'glow' },
    water_sky: { sky: 'sky', hill: 'mist', water: 'lavender', extra: 'clouds' },
  };
  const h = hashString(key);
  const look = looks[key] ?? {
    sky: FISH_BODIES[h % FISH_BODIES.length]!,
    hill: 'moss',
    water: 'dusk',
    extra: scene?.hills ?? 'rolling',
  };
  f.rect(0, 0, 32, 14, look.sky);
  f.ellipse(9, 16, 12, 6, look.hill);
  f.ellipse(25, 17, 10, 5, SHADE_DOWN[look.hill]);
  f.rect(0, 14, 32, 10, look.water);
  f.line(4, 17, 9, 17, SHADE_UP[look.water]);
  f.line(18, 20, 25, 20, SHADE_UP[look.water]);
  if (look.extra === 'moon') {
    f.disc(25, 5, 2.6, 'mist');
    f.px(5, 3, 'gold');
    f.px(12, 6, 'mist');
    f.px(17, 2, 'gold');
  } else if (look.extra === 'pines') {
    for (const x of [5, 10, 14]) f.poly([[x - 2, 14], [x, 7], [x + 2, 14]], 'moss');
  } else if (look.extra === 'reeds') {
    for (const x of [26, 28, 29]) f.line(x, 22, x, 16, 'moss');
    f.px(28, 15, 'bark');
  } else if (look.extra === 'glow') {
    for (const [x, y] of [[4, 4], [11, 9], [20, 3], [27, 8], [15, 12]] as [number, number][]) f.px(x, y, 'lavender');
  } else if (look.extra === 'clouds') {
    f.ellipse(8, 6, 5, 2, 'mist');
    f.ellipse(23, 10, 6, 2, 'mist');
  }
}

function drawDecor(f: FrameCanvas, key: string): void {
  switch (key) {
    case 'decor_lanterns':
      f.line(0, 1, 19, 3, 'sand');
      for (const x of [3, 9, 15]) {
        const y = 2 + Math.round(x / 9);
        f.rect(x, y + 1, 3, 4, x === 9 ? 'gold' : 'coral');
        f.px(x + 1, y + 2, 'mist');
      }
      return;
    case 'decor_chimes':
      f.rect(7, 0, 6, 1, 'bark');
      for (const [x, len] of [[8, 5], [10, 7], [12, 4]] as [number, number][]) {
        f.line(x, 1, x, len, 'slate');
        f.px(x, len + 1, 'sky');
      }
      return;
    case 'decor_cat':
      f.ellipse(10, 9, 4, 3, 'coral');
      f.ellipse(13, 5, 2.6, 2.4, 'coral');
      f.px(11, 2, 'coral');
      f.px(15, 2, 'coral');
      f.line(6, 9, 5, 5, 'coral');
      f.outline((n) => SHADE_DOWN[n]);
      f.px(13, 5, 'ink');
      f.px(15, 5, 'ink');
      return;
    case 'decor_pennant':
      f.poly([[0, 0], [12, 3], [0, 7]], 'coral');
      f.px(3, 3, 'gold');
      f.px(4, 3, 'gold');
      return;
    default: {
      const h = hashString(key);
      const c = FISH_BODIES[h % FISH_BODIES.length]!;
      f.ellipse(10, 6, 5, 4, c);
      f.outline((n) => SHADE_DOWN[n]);
    }
  }
}

function drawFx(f: FrameCanvas, key: string, frame: number): void {
  if (key === 'fx_sparkle') {
    if (frame === 0) {
      f.px(2, 0, 'mist');
      f.px(2, 4, 'mist');
      f.px(0, 2, 'mist');
      f.px(4, 2, 'mist');
      f.px(2, 1, 'gold');
      f.px(2, 3, 'gold');
      f.px(1, 2, 'gold');
      f.px(3, 2, 'gold');
      f.px(2, 2, 'mist');
    } else {
      f.px(2, 2, 'mist');
      f.px(1, 1, 'gold');
      f.px(3, 3, 'gold');
      f.px(1, 3, 'gold');
      f.px(3, 1, 'gold');
    }
    return;
  }
  if (key === 'fx_splash') {
    const spread = frame + 1;
    for (const s of [-1, 1]) {
      f.px(6 + s * (1 + spread), 4 - frame, 'mist');
      f.px(6 + s * (2 + spread), 5 - frame, 'sky');
      f.px(6 + s * spread, 3 - frame, 'sky');
    }
    f.px(6, 5 - frame, 'mist');
  }
}

// ---------------------------------------------------------------- icons (12x12)

function drawIcon(f: FrameCanvas, name: string): void {
  switch (name) {
    case 'coin':
      f.disc(6, 6, 4.6, 'gold');
      f.outline('coral');
      f.line(4, 3, 3, 5, 'mist');
      f.rect(5, 5, 2, 2, 'sand');
      f.px(8, 8, 'coral');
      return;
    case 'rod':
      f.line(1, 11, 9, 2, 'bark');
      f.px(10, 1, 'sand');
      f.rect(3, 7, 2, 2, 'slate');
      f.line(10, 2, 10, 8, 'mist');
      f.px(10, 9, 'coral');
      f.px(10, 10, 'mist');
      return;
    case 'boat':
      f.poly([[0.5, 7], [11.5, 7], [9.5, 10.5], [2.5, 10.5]], 'bark');
      f.line(1, 7, 10, 7, 'sand');
      f.rect(6, 1, 1, 6, 'bark');
      f.poly([[7, 1], [11, 5.5], [7, 5.5]], 'mist');
      return;
    case 'crew':
      f.disc(6, 4, 2.2, 'sand');
      f.rect(4, 1, 4, 1, 'sky');
      f.rect(3, 2, 6, 1, 'sky');
      f.poly([[2, 11.5], [3, 7], [9, 7], [10, 11.5]], 'sage');
      f.px(5, 4, 'ink');
      f.px(7, 4, 'ink');
      return;
    case 'journal':
      f.rect(2, 1, 8, 10, 'plum');
      f.rect(3, 2, 6, 8, 'lavender');
      f.rect(4, 3, 4, 1, 'mist');
      f.rect(4, 5, 3, 1, 'mist');
      f.rect(8, 0, 1, 4, 'gold');
      f.rect(2, 1, 1, 10, 'midnight');
      return;
    case 'settings':
      for (const [x, y] of [[5, 0], [6, 0], [5, 11], [6, 11], [0, 5], [0, 6], [11, 5], [11, 6], [2, 2], [9, 2], [2, 9], [9, 9]] as [number, number][]) f.px(x, y, 'slate');
      f.disc(6, 6, 4.4, 'slate');
      f.disc(6, 6, 1.6, 'midnight');
      f.px(4, 3, 'sky');
      return;
    case 'sound':
    case 'mute':
      f.rect(1, 4, 2, 4, 'mist');
      f.poly([[3, 4], [6.5, 1], [6.5, 11], [3, 8]], 'mist');
      if (name === 'sound') {
        f.line(8, 4, 8, 7, 'sky');
        f.line(10, 2, 10, 9, 'sky');
      } else {
        f.line(8, 4, 11, 7, 'coral');
        f.line(11, 4, 8, 7, 'coral');
      }
      return;
    case 'lock':
      f.rect(3, 1, 6, 1, 'slate');
      f.rect(2, 2, 1, 4, 'slate');
      f.rect(9, 2, 1, 4, 'slate');
      f.rect(1, 5, 10, 6, 'gold');
      f.rect(1, 10, 10, 1, 'coral');
      f.rect(5, 7, 2, 2, 'bark');
      return;
    case 'map':
      f.poly([[0.5, 2], [4, 1], [8, 2], [11.5, 1], [11.5, 10], [8, 11], [4, 10], [0.5, 11]], 'sand');
      f.line(4, 1, 4, 10, 'bark');
      f.line(8, 2, 8, 11, 'bark');
      f.px(2, 8, 'coral');
      f.px(3, 6, 'coral');
      f.px(6, 5, 'coral');
      f.px(9, 4, 'coral');
      f.px(10, 3, 'coral');
      return;
    case 'star':
      f.stamp(0, 0, [
        '.....g......',
        '.....g......',
        '....ggg.....',
        'gggggmgggggg',
        '.ggggmgggg..',
        '..gggggggg..',
        '...gggggg...',
        '...ggg.ggg..',
        '..ggg...gg..',
        '..gg.....g..',
        '............',
        '............',
      ]);
      return;
    case 'bait':
      f.line(2, 9, 4, 7, 'coral');
      f.line(4, 7, 6, 8, 'coral');
      f.line(6, 8, 8, 5, 'coral');
      f.line(8, 5, 10, 3, 'coral');
      f.px(10, 2, 'rose');
      f.px(5, 9, 'gold');
      f.px(9, 7, 'gold');
      return;
    case 'creel':
      f.poly([[1, 4], [11, 4], [10, 11], [2, 11]], 'bark');
      for (let y = 5; y < 11; y += 2) f.line(2, y, 10, y, 'sand');
      f.rect(4, 1, 4, 1, 'bark');
      f.px(3, 2, 'bark');
      f.px(8, 2, 'bark');
      f.px(3, 3, 'bark');
      f.px(8, 3, 'bark');
      return;
    case 'note':
      f.rect(7, 1, 1, 8, 'mist');
      f.rect(8, 1, 3, 1, 'mist');
      f.rect(10, 2, 1, 2, 'mist');
      f.disc(5.5, 9, 2, 'mist');
      return;
    case 'moon':
      f.disc(6, 6, 4.6, 'mist');
      for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
        const dx = x + 0.5 - 8.2;
        const dy = y + 0.5 - 4.5;
        if (dx * dx + dy * dy <= 3.8 * 3.8) f.px(x, y, null);
      }
      f.px(3, 7, 'sky');
      return;
    case 'clear':
      f.line(6, 1, 6, 10, 'sky');
      f.line(1, 6, 10, 6, 'sky');
      f.rect(5, 5, 3, 3, 'mist');
      f.px(3, 3, 'sky');
      f.px(9, 3, 'sky');
      f.px(3, 9, 'sky');
      f.px(9, 9, 'sky');
      return;
    case 'sun':
      f.disc(6, 6, 3, 'gold');
      for (const [x, y] of [[6, 0], [5, 0], [6, 11], [5, 11], [0, 6], [0, 5], [11, 6], [11, 5], [2, 2], [9, 2], [2, 9], [9, 9]] as [number, number][]) f.px(x, y, 'coral');
      f.px(5, 4, 'sand');
      return;
    case 'dusk':
      f.disc(6, 8, 4, 'coral');
      f.rect(0, 8, 12, 4, 'plum');
      f.line(0, 8, 11, 8, 'gold');
      f.px(2, 2, 'mist');
      return;
    case 'dawn':
      f.disc(6, 8, 4, 'gold');
      f.rect(0, 8, 12, 4, 'dusk');
      f.line(0, 8, 11, 8, 'sand');
      f.px(6, 1, 'gold');
      f.px(2, 3, 'gold');
      f.px(10, 3, 'gold');
      return;
    case 'rain':
      f.ellipse(6, 4, 5, 2.6, 'sky');
      f.ellipse(4, 3.5, 2.6, 2.4, 'mist');
      for (const [x, y] of [[3, 8], [6, 9], [9, 8], [4, 11], [8, 11]] as [number, number][]) f.px(x, y, 'sky');
      return;
    case 'fog':
      f.line(1, 3, 9, 3, 'mist');
      f.line(3, 6, 11, 6, 'sky');
      f.line(0, 9, 8, 9, 'mist');
      return;
    case 'lantern':
      f.rect(5, 0, 2, 1, 'bark');
      f.rect(3, 2, 6, 1, 'bark');
      f.rect(3, 3, 6, 6, 'coral');
      f.rect(4, 4, 4, 4, 'gold');
      f.rect(3, 9, 6, 1, 'bark');
      f.px(5, 5, 'mist');
      return;
    case 'cat':
      f.disc(6, 7, 4.4, 'coral');
      f.poly([[1.5, 5], [2.5, 0.5], [5, 3]], 'coral');
      f.poly([[10.5, 5], [9.5, 0.5], [7, 3]], 'coral');
      f.px(4, 6, 'ink');
      f.px(8, 6, 'ink');
      f.px(6, 8, 'rose');
      return;
    case 'flag':
      f.rect(2, 0, 1, 12, 'bark');
      f.poly([[3, 1], [11, 3.5], [3, 6]], 'coral');
      f.px(5, 3, 'gold');
      return;
    case 'close':
      f.line(2, 2, 9, 9, 'mist');
      f.line(9, 2, 2, 9, 'mist');
      f.line(3, 2, 9, 8, 'mist');
      f.line(8, 2, 2, 8, 'mist');
      return;
    case 'check':
      f.line(1, 6, 4, 9, 'sage');
      f.line(4, 9, 10, 2, 'sage');
      f.line(1, 7, 4, 10, 'sage');
      f.line(4, 10, 10, 3, 'sage');
      return;
    case 'gift':
      f.rect(1, 4, 10, 7, 'coral');
      f.rect(0, 3, 12, 2, 'rose');
      f.rect(5, 3, 2, 8, 'gold');
      f.px(3, 1, 'gold');
      f.px(4, 2, 'gold');
      f.px(8, 1, 'gold');
      f.px(7, 2, 'gold');
      return;
    case 'arrow':
      f.poly([[3, 1], [9, 6], [3, 11]], 'mist');
      return;
    case 'motion':
      f.disc(4, 6, 2.5, 'sky');
      f.line(7, 4, 11, 4, 'slate');
      f.line(7, 8, 11, 8, 'slate');
      f.line(8, 6, 11, 6, 'mist');
      return;
    default: {
      // Unknown icon: a soft dot so missing art is visible but not alarming.
      f.disc(6, 6, 3.5, 'slate');
      f.disc(6, 6, 1.5, 'mist');
    }
  }
}
