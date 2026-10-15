// The four top boats each belong to a water: a coral catamaran for the reef, a
// shell barge with mushroom lamps for the cave, a bowl-shaped skimmer that
// looks ready to lift off for Sky Lake, and the Starlight Schooner, a navy and
// gold ship of the line. Hulls are 32 px tall (deck at y 17, water at 26);
// rigs are taller and drawn behind the fisher. BOAT_LIGHTS lists the points the
// world scene makes glimmer by day and glow at night.
import type { PaletteName } from '../design/tokens';
import { SHADE_DOWN, type FrameCanvas } from './pixelCanvas';

/** First tier drawn here; lower tiers use the shared boat style. */
export const HIGH_BOAT_TIER = 7;

export interface BoatLight {
  /** Position in the hull sprite (rig lights use negative y above the hull). */
  x: number;
  y: number;
  color: PaletteName;
  /** lamp: a warm glow at night; twinkle: a sparkle; thruster: a glow under the hull; blink: a slow on and off. */
  kind: 'lamp' | 'twinkle' | 'thruster' | 'blink';
}

/** Light points per tier, from the bow and stern of each design. Rig y is hull y minus the rig raise. */
export function boatLights(tier: number, w: number, rigRaise: number): BoatLight[] {
  const r = (y: number) => y - rigRaise;
  switch (tier) {
    case 7:
      return [
        { x: w - 3, y: 12, color: 'gold', kind: 'lamp' },
        { x: 3, y: 13, color: 'gold', kind: 'lamp' },
      ];
    case 8:
      return [
        { x: w - 5, y: r(rigRaise + 8), color: 'gold', kind: 'lamp' },
        { x: 3, y: r(rigRaise + 8), color: 'gold', kind: 'lamp' },
        ...[0, 1, 2, 3, 4, 5].map((i): BoatLight => ({ x: 8 + i * 6, y: r(rigRaise - 3 + (i % 2)), color: 'sage', kind: 'twinkle' })),
      ];
    case 9:
      return [
        ...[0.25, 0.5, 0.75].map((t): BoatLight => ({ x: Math.round(4 + (w - 8) * t), y: 27, color: 'sky', kind: 'thruster' })),
        { x: w - 15, y: r(rigRaise - 10), color: 'coral', kind: 'blink' },
      ];
    case 10:
      return [
        { x: 2, y: 9, color: 'gold', kind: 'lamp' },
        { x: w - 3, y: 13, color: 'gold', kind: 'lamp' },
        { x: w - 15, y: r(1), color: 'gold', kind: 'twinkle' },
        { x: 27, y: r(9), color: 'gold', kind: 'twinkle' },
        { x: w - 19, y: r(15), color: 'gold', kind: 'twinkle' },
      ];
    default:
      return [];
  }
}

const shade = (n: PaletteName) => SHADE_DOWN[n];

export function drawHighHull(f: FrameCanvas, tier: number, w: number): void {
  if (tier === 7) catamaranHull(f, w);
  else if (tier === 8) bargeHull(f, w);
  else if (tier === 9) skimmerHull(f, w);
  else schoonerHull(f, w);
}

export function drawHighRig(f: FrameCanvas, tier: number, w: number, raise: number): void {
  const deck = raise + 20;
  if (tier === 7) catamaranRig(f, w, deck);
  else if (tier === 8) bargeRig(f, w, deck);
  else if (tier === 9) skimmerRig(f, w, deck);
  else schoonerRig(f, w, deck);
}

// ---------------------------------------------------------------- tier 7: Coral Catamaran

function catamaranHull(f: FrameCanvas, w: number): void {
  const split = Math.round(w * 0.45);
  // Two slim pontoons, rounded at both ends, with water between them.
  for (const [a, b] of [
    [2, split - 3],
    [split + 3, w - 2],
  ] as const) {
    f.poly([[a, 18], [b - 2, 18], [b, 20], [b - 3, 25.5], [a + 3, 25.5], [a, 21]], 'sand');
    f.rect(a + 2, 23, b - a - 4, 2, 'coral');
  }
  f.outline(shade);
  // The deck that joins them, with a polished rail.
  f.rect(1, 16, w - 2, 2, 'bark');
  f.rect(1, 16, w - 2, 1, 'sand');
  for (let x = 3; x < w - 3; x += 4) f.px(x, 15, 'sand');
  f.line(3, 14, w - 4, 14, 'sand');
  // Brass portholes and a coral stripe on each pontoon.
  for (let x = 6; x < w - 4; x += 6) if (Math.abs(x - split) > 4) f.px(x, 21, 'gold');
  // A curled bow and a stern lantern post.
  f.px(w - 2, 15, 'coral');
  f.px(w - 1, 14, 'coral');
  f.px(w - 3, 13, 'bark');
  f.px(3, 14, 'bark');
}

function catamaranRig(f: FrameCanvas, w: number, deck: number): void {
  const m = w - 15;
  f.rect(m, 4, 1, deck - 4, 'bark');
  // A striped mainsail and a small jib.
  for (let r = 0; r < deck - 10; r++) {
    const width = Math.round(r * 0.55) + 1;
    f.rect(m + 1, 6 + r, width, 1, Math.floor(r / 3) % 2 ? 'sand' : 'coral');
  }
  f.poly([[m - 1, 10], [m - 1, deck - 5], [m - 9, deck - 5]], 'mist');
  // Bunting from the masthead down to the stern.
  for (let i = 0; i < 12; i++) {
    const x = Math.round(m - 2 - ((m - 6) * i) / 11);
    const y = Math.round(5 + ((deck - 13) * i) / 11);
    f.px(x, y, 'bark');
    if (i % 2 === 1) f.px(x, y + 1, i % 4 === 1 ? 'gold' : 'sky');
  }
  f.rect(m + 1, 4, 3, 1, 'gold');
}

// ---------------------------------------------------------------- tier 8: Glowshell Barge

function bargeHull(f: FrameCanvas, w: number): void {
  const bow = w - 1;
  f.poly([[1, 17], [bow - 3, 17], [bow, 15], [bow - 3, 26], [5, 26], [1, 22]], 'lavender');
  for (let x = 0; x < w; x++) for (let y = 24; y < 27; y++) if (f.get(x, y) === 'lavender') f.px(x, y, 'plum');
  f.outline(shade);
  f.line(2, 18, bow - 3, 18, 'mist');
  // Shell scallops along the side.
  for (let x = 4; x < bow - 6; x += 6) {
    f.px(x, 21, 'mist');
    f.px(x + 1, 20, 'mist');
    f.px(x + 2, 20, 'mist');
    f.px(x + 3, 21, 'mist');
    f.px(x + 1, 22, 'sky');
  }
}

function bargeRig(f: FrameCanvas, w: number, deck: number): void {
  // A low roof on posts over the stern half, for the cave.
  const roofEnd = Math.round(w * 0.6);
  // Above the crew's heads (they stand 24 px tall on the deck).
  const roof = deck - 27;
  for (const x of [4, Math.round(roofEnd / 2), roofEnd - 2]) f.rect(x, roof + 2, 1, deck - roof - 2, 'bark');
  f.rect(2, roof, roofEnd, 2, 'plum');
  f.rect(1, roof + 2, roofEnd + 2, 1, 'lavender');
  // Scalloped shell edge on the roof.
  for (let x = 3; x < roofEnd; x += 4) f.px(x, roof + 3, 'lavender');
  // Glow-worm string under the roof (the light layer makes them twinkle).
  for (let i = 0; i < 6; i++) f.px(8 + i * 6, roof + 4 + (i % 2), 'sage');
  // Mushroom lamps at the bow and stern: stalks with glowing caps.
  for (const x of [3, w - 5]) {
    f.rect(x, deck - 10, 1, 10, 'sage');
    f.rect(x - 2, deck - 12, 5, 2, 'gold');
    f.rect(x - 1, deck - 13, 3, 1, 'coral');
    f.px(x - 2, deck - 11, 'coral');
    f.px(x + 2, deck - 11, 'coral');
  }
  // A short mast with a pennant, so it still reads as a boat.
  const m = w - 15;
  f.rect(m, deck - 18, 1, 18, 'bark');
  f.rect(m + 1, deck - 18, 5, 1, 'lavender');
  f.rect(m + 1, deck - 17, 3, 1, 'lavender');
}

// ---------------------------------------------------------------- tier 9: Cloud Skimmer

function skimmerHull(f: FrameCanvas, w: number): void {
  // A smooth bowl: a bright upper shell, a darker belly, and a deep rounded underside.
  const cx = w / 2;
  const rx = w / 2 - 1.5;
  for (let x = 0; x < w; x++) {
    const t = (x + 0.5 - cx) / rx;
    if (Math.abs(t) > 1) continue;
    const depth = Math.round(9 * Math.sqrt(1 - t * t));
    for (let y = 17; y <= 17 + depth; y++) f.px(x, y, y <= 20 ? 'mist' : y <= 23 ? 'slate' : 'dusk');
  }
  f.outline('ink');
  // A chrome rim, and a strip of running lights around the middle.
  for (let x = 0; x < w; x++) if (f.get(x, 17) === 'mist') f.px(x, 17, 'sky');
  for (let x = 2; x < w - 2; x++) if (f.get(x, 21) === 'slate') f.px(x, 21, x % 3 === 0 ? 'mist' : 'sky');
  // Swept fins at both ends, tipped in light.
  f.poly([[0, 21], [7, 18], [8, 21], [2, 23]], 'sky');
  f.poly([[w, 21], [w - 7, 18], [w - 8, 21], [w - 2, 23]], 'sky');
  f.px(0, 21, 'mist');
  f.px(w - 1, 21, 'mist');
  // Thruster pods underneath (the light layer adds their glow).
  for (const t of [0.25, 0.5, 0.75]) {
    const x = Math.round(4 + (w - 8) * t);
    f.rect(x - 1, 25, 3, 1, 'slate');
    f.px(x, 26, 'sky');
  }
}

function skimmerRig(f: FrameCanvas, w: number, deck: number): void {
  // No sail: a slim mast with a ring antenna, and a tall swept fin behind the crew.
  const m = w - 15;
  const top = deck - 30;
  f.rect(m, top, 1, deck - top, 'slate');
  f.px(m - 1, top + 2, 'sky');
  f.px(m + 1, top + 2, 'sky');
  f.px(m, top + 1, 'sky');
  f.px(m, top + 3, 'sky');
  f.poly([[2, deck], [6, deck - 22], [9, deck - 22], [12, deck]], 'slate');
  f.line(6, deck - 22, 3, deck - 1, 'sky');
  f.line(9, deck - 22, 11, deck - 1, 'mist');
  for (let y = deck - 18; y < deck - 2; y += 4) f.px(7, y, 'sky');
}

// ---------------------------------------------------------------- tier 10: Starlight Schooner

function schoonerHull(f: FrameCanvas, w: number): void {
  const bow = w - 3;
  // A ship of the line: a raised stern castle, a long sweep to the bow.
  f.poly([[1, 13], [13, 13], [15, 16], [bow - 3, 16.5], [bow, 14.5], [bow - 3, 26], [6, 26], [1, 20]], 'midnight');
  for (let x = 0; x < w; x++) for (let y = 24; y < 27; y++) if (f.get(x, y) === 'midnight') f.px(x, y, 'ink');
  f.outline('ink');
  // Gold trim: the deck line, the wale, and the castle edge.
  f.line(2, 17, bow - 3, 17, 'gold');
  f.line(4, 22, bow - 4, 21, 'gold');
  f.line(1, 13, 13, 13, 'gold');
  // Stern gallery windows, warm and lit.
  for (let x = 3; x < 12; x += 3) {
    f.rect(x, 14, 2, 2, 'gold');
    f.px(x, 15, 'sand');
  }
  // A row of gunports, gold rimmed.
  for (let x = 18; x < bow - 6; x += 5) {
    f.rect(x, 19, 2, 2, 'ink');
    f.px(x + 2, 19, 'gold');
  }
  // Bowsprit and a figurehead star.
  f.line(bow - 1, 15, w - 1, 11, 'gold');
  f.px(bow, 16, 'gold');
}

function schoonerRig(f: FrameCanvas, w: number, deck: number): void {
  // Two masts, each square-rigged with full gold sails above the crew's heads.
  // Rigging lines run from the mastheads to the stern and the bowsprit, so the
  // masts read as part of the ship even where the crew stand in front of them.
  const masts = [w - 15, 26];
  f.line(26, 4, 2, deck - 8, 'bark');
  f.line(w - 15, 1, w - 1, deck - 30, 'bark');
  f.line(w - 15, 1, 26, 4, 'bark');
  masts.forEach((m, i) => {
    const top = i === 0 ? 1 : 4;
    f.rect(m, top, 1, deck - top, 'bark');
    const half = i === 0 ? 8 : 7;
    // Topsail, then a bigger course below it, each hung from a yard that
    // reaches past the sail so it reads as a whole sail.
    for (const [y, h, wd] of [
      [top + 3, 6, half - 2],
      [top + 11, 7, half],
    ] as const) {
      f.rect(m - wd - 1, y - 1, wd * 2 + 3, 1, 'bark');
      f.rect(m - wd, y, wd * 2 + 1, h, 'gold');
      f.line(m - wd + 1, y + h - 1, m + wd - 1, y + h - 1, 'sand');
      f.px(m - wd, y + h - 1, 'sand');
      f.px(m + wd, y + h - 1, 'sand');
      f.px(m - wd + 2, y + 2, 'mist');
    }
    // A long coral pennant streaming from each masthead.
    f.rect(m + 1, top, 5, 1, 'coral');
    f.rect(m + 1, top + 1, 3, 1, 'coral');
  });
  // The masthead star.
  const sx = w - 15;
  f.px(sx, 0, 'mist');
  f.px(sx - 1, 1, 'gold');
  f.px(sx + 1, 1, 'gold');
}
