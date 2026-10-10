// The visual identity in one place. Every color in the game comes from PALETTE.
// No pure black or white, no harsh reds: the brightest and darkest tones are tinted.

export const PALETTE = {
  ink: 0x0b1026, // deep night, darkest tone
  midnight: 0x1d2b53, // night sky, night water
  dusk: 0x3d5a80, // dusk blue, deep water by day
  sky: 0x98c1d9, // pale day sky, rare rarity
  mist: 0xe4eef0, // brightest tone, highlights and text
  gold: 0xffd166, // sun, lanterns, legendary
  coral: 0xef8354, // sunset, bobber
  rose: 0xc76b7e, // dusk haze
  plum: 0x5e4b7a, // dusk hills, epic frame
  lavender: 0xa99bd4, // epic glow, dawn sky
  teal: 0x2a6f77, // day water
  moss: 0x4f7a5a, // reeds, near hills
  sage: 0xa8c99a, // soft green, uncommon
  slate: 0x7d8ca3, // soft gray blue, common, far hills
  bark: 0x7a5244, // boat wood
  sand: 0xe8c9a0, // light wood, skin, sand
} as const;

export type PaletteName = keyof typeof PALETTE;
export const PALETTE_NAMES = Object.keys(PALETTE) as PaletteName[];

export function isPaletteName(name: string): name is PaletteName {
  return Object.prototype.hasOwnProperty.call(PALETTE, name);
}

export function color(name: PaletteName): number {
  return PALETTE[name];
}

export function cssColor(name: PaletteName): string {
  return '#' + PALETTE[name].toString(16).padStart(6, '0');
}

export function rgb(name: PaletteName): [number, number, number] {
  const c = PALETTE[name];
  return [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
}

/** Per time-of-day scene colors. Sky bands go top to bottom and are dithered together. */
export interface ScenePalette {
  skyBands: PaletteName[];
  celestial: PaletteName; // sun or moon
  celestialKind: 'sun' | 'moon';
  clouds: PaletteName;
  stars: number; // 0..1 star visibility
  hillsFar: PaletteName;
  hillsNear: PaletteName;
  waterTop: PaletteName;
  waterDeep: PaletteName;
  waterShine: PaletteName;
  foreground: PaletteName;
  foregroundAccent: PaletteName;
  boatShade: PaletteName; // shaded side of the boat
  fireflies: number; // 0..1 firefly density
  textOnWorld: PaletteName; // readable text color over this sky
}

export const SCENE_PALETTES: Record<string, ScenePalette> = {
  day: {
    skyBands: ['sky', 'sky', 'mist'],
    celestial: 'gold',
    celestialKind: 'sun',
    clouds: 'mist',
    stars: 0,
    hillsFar: 'slate',
    hillsNear: 'moss',
    waterTop: 'sky',
    waterDeep: 'teal',
    waterShine: 'mist',
    foreground: 'moss',
    foregroundAccent: 'sage',
    boatShade: 'bark',
    fireflies: 0,
    textOnWorld: 'mist',
  },
  dusk: {
    skyBands: ['plum', 'rose', 'coral', 'gold'],
    celestial: 'gold',
    celestialKind: 'sun',
    clouds: 'rose',
    stars: 0.15,
    hillsFar: 'plum',
    hillsNear: 'midnight',
    waterTop: 'rose',
    waterDeep: 'plum',
    waterShine: 'gold',
    foreground: 'ink',
    foregroundAccent: 'plum',
    boatShade: 'plum',
    fireflies: 1,
    textOnWorld: 'mist',
  },
  night: {
    skyBands: ['ink', 'midnight', 'dusk'],
    celestial: 'mist',
    celestialKind: 'moon',
    clouds: 'dusk',
    stars: 1,
    hillsFar: 'midnight',
    hillsNear: 'ink',
    waterTop: 'dusk',
    waterDeep: 'midnight',
    waterShine: 'sky',
    foreground: 'ink',
    foregroundAccent: 'midnight',
    boatShade: 'midnight',
    fireflies: 0.6,
    textOnWorld: 'mist',
  },
  dawn: {
    skyBands: ['dusk', 'lavender', 'rose', 'sand'],
    celestial: 'gold',
    celestialKind: 'sun',
    clouds: 'lavender',
    stars: 0.3,
    hillsFar: 'lavender',
    hillsNear: 'plum',
    waterTop: 'lavender',
    waterDeep: 'dusk',
    waterShine: 'sand',
    foreground: 'midnight',
    foregroundAccent: 'plum',
    boatShade: 'plum',
    fireflies: 0.2,
    textOnWorld: 'mist',
  },
};

/** Spacing scale in internal pixels. */
export const SPACING = { xxs: 1, xs: 2, sm: 4, md: 6, lg: 8, xl: 12, xxl: 16 } as const;

/** UI metrics. Touch targets never go below minTouch. */
export const UI = {
  minTouch: 24,
  panelPadding: 6,
  panelBorder: 1,
  buttonHeight: 24,
  bigButtonHeight: 32,
  iconSize: 12,
  menuBarHeight: 28,
  topBarHeight: 18,
  /** Widest a menu bar slot gets, so wide screens keep the icons grouped. */
  menuSlotMax: 40,
  /** Boat x sits this far left of center so boat plus bobber look centered. */
  boatGroupOffset: 25,
  /** Panels never grow past this, so text lines stay short on big screens. */
  panelMaxWidth: 200,
  panelMaxHeight: 340,
  scrollFriction: 0.9,
} as const;

/** UI colors by role so components never pick raw palette names ad hoc. */
export const UI_COLORS = {
  panelFill: 'midnight',
  panelBorder: 'dusk',
  panelHighlight: 'sky',
  panelShadow: 'ink',
  text: 'mist',
  textMuted: 'slate',
  textAccent: 'gold',
  buttonFill: 'dusk',
  buttonFillHover: 'slate',
  buttonFillPressed: 'midnight',
  buttonFillDisabled: 'midnight',
  buttonText: 'mist',
  buttonTextDisabled: 'slate',
  primaryFill: 'coral',
  primaryFillHover: 'gold',
  primaryText: 'ink',
  affordable: 'gold',
  locked: 'slate',
  owned: 'sage',
  progressBack: 'ink',
  progressFill: 'sage',
  toastFill: 'ink',
  backdrop: 'ink',
} as const satisfies Record<string, PaletteName>;

/** Typography: one baked pixel font, scaled by whole numbers only. */
export const TYPOGRAPHY = {
  fontFamily: 'Pixelify Sans',
  fontFile: 'fonts/PixelifySans.ttf',
  fallbackFamily: 'monospace',
  bitmapKey: 'pixel',
  // Pixelify Sans draws on a grid of about 91.5 font units per design pixel, so at
  // 11px one design pixel is one screen pixel. The offsets move the glyph grid
  // (60 units left bearing, -12 units baseline overshoot) onto whole pixels.
  bakeSize: 11,
  gridOffsetX: -0.66,
  gridOffsetY: -0.13,
  ascentPx: 9,
  descentPx: 3,
  alphaThreshold: 128, // 0..255, below this a pixel is transparent
  lineSpacing: 1,
  letterSpacing: 0,
  titleScale: 2,
} as const;

/** Fallback rarity styling for glow levels when data does not override. */
export const RARITY_GLOW = {
  0: { pulse: 0, sparkles: 0 },
  1: { pulse: 0.15, sparkles: 1 },
  2: { pulse: 0.3, sparkles: 2 },
  3: { pulse: 0.5, sparkles: 4 },
  4: { pulse: 0.7, sparkles: 7 },
} as const satisfies Record<number, { pulse: number; sparkles: number }>;

/** Motion timings (ms). Everything slow and eased. */
export const MOTION = {
  panelOpen: 220,
  toastIn: 260,
  toastHold: 2200,
  toastOut: 600,
  popupIn: 280,
  popupOut: 160,
  panelClose: 140,
  /** One twinkle of a catch sparkle (half fades in, half fades out). */
  sparkleTwinkle: 900,
  buttonPress: 80,
  bobPeriod: 2600,
  shimmerPeriod: 3200,
  ease: 'Sine.easeInOut',
  easeOut: 'Sine.easeOut',
} as const;
