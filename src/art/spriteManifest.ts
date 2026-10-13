// Every sprite the game uses, by key. Placeholders are generated from the
// palette at boot. To use real art: drop a PNG into public/sprites/ and add the
// key and path to ART_FILES below. Nothing else changes.
//
// Sprite sheets are horizontal strips: frame N sits at x = N * width.

export type PlaceholderKind =
  | 'fish'
  | 'boat'
  | 'fisher'
  | 'bobber'
  | 'icon'
  | 'crew'
  | 'water'
  | 'decor'
  | 'fx';

export interface SpriteEntry {
  key: string;
  width: number;
  height: number;
  frames: number;
  kind: PlaceholderKind;
  /** Path under public/, set from ART_FILES when real art exists. */
  file?: string;
}

/**
 * Real art overrides. Example:
 *   fish_lantern_carp: 'sprites/fish/lantern_carp.png',
 * The PNG must match the width, height, and frame count listed for that key.
 */
export const ART_FILES: Record<string, string> = {};

const ICONS = [
  'coin', 'rod', 'boat', 'crew', 'journal', 'settings', 'mute', 'sound', 'lock', 'map',
  'star', 'bait', 'creel', 'note', 'moon', 'sun', 'dusk', 'dawn', 'clear', 'rain', 'fog',
  'lantern', 'cat', 'flag', 'close', 'check', 'gift', 'arrow', 'motion', 'daily', 'wind', 'storm', 'gem',
] as const;

export type IconName = (typeof ICONS)[number];

const STATIC: SpriteEntry[] = [
  { key: 'boat', width: 32, height: 32, frames: 1, kind: 'boat' },
  { key: 'fisher', width: 16, height: 24, frames: 4, kind: 'fisher' },
  { key: 'bobber', width: 8, height: 8, frames: 2, kind: 'bobber' },
  { key: 'fx_sparkle', width: 5, height: 5, frames: 2, kind: 'fx' },
  { key: 'fx_splash', width: 12, height: 6, frames: 3, kind: 'fx' },
  ...ICONS.map((name): SpriteEntry => ({ key: `icon_${name}`, width: 12, height: 12, frames: 1, kind: 'icon' })),
];

/** Keys that content refers to (fish_*, crew_*, ...) get their size from the prefix. */
export const PREFIX_RULES: { prefix: string; width: number; height: number; frames: number; kind: PlaceholderKind }[] = [
  { prefix: 'fish_', width: 16, height: 16, frames: 1, kind: 'fish' },
  { prefix: 'crew_', width: 16, height: 24, frames: 2, kind: 'crew' },
  { prefix: 'water_', width: 32, height: 24, frames: 1, kind: 'water' },
  { prefix: 'decor_', width: 20, height: 12, frames: 1, kind: 'decor' },
  { prefix: 'icon_', width: 12, height: 12, frames: 1, kind: 'icon' },
  // Boat tiers: boat_N is the hull, rig_N the mast and sail drawn behind the fisher.
  // A rig is 16 px taller than the hull and sits 16 px higher, so sails clear the fisher.
  { prefix: 'boat_', width: 32, height: 32, frames: 1, kind: 'boat' },
  { prefix: 'rig_', width: 32, height: 48, frames: 1, kind: 'boat' },
  // Fisher outfits (gem cosmetics): same frames as the fisher.
  { prefix: 'fisher_', width: 16, height: 24, frames: 4, kind: 'fisher' },
];

export function staticSprites(): SpriteEntry[] {
  return STATIC.map(withFile);
}

/**
 * Hull width per boat tier (boat_1 to boat_10). Boats grow toward the stern
 * (left), so the fisher, rod, and bobber stay put and the extra deck holds
 * crew, crates, and spare rods.
 */
export const BOAT_WIDTHS = [32, 34, 38, 42, 48, 52, 58, 62, 68, 72] as const;

/** Tier from a boat_N or rig_N key (1 for the starter boat). */
export function boatTier(key: string): number {
  const n = Number(key.split('_').pop());
  return Number.isFinite(n) ? Math.max(1, Math.min(BOAT_WIDTHS.length, n)) : 1;
}

export function boatWidth(key: string): number {
  return key.startsWith('boat_') || key.startsWith('rig_') ? BOAT_WIDTHS[boatTier(key) - 1]! : 32;
}

/** Resolve any key, including content keys not listed above. */
export function resolveSprite(key: string): SpriteEntry {
  const known = STATIC.find((s) => s.key === key);
  if (known) return withFile(known);
  const rule = PREFIX_RULES.find((r) => key.startsWith(r.prefix));
  if (rule) return withFile({ key, width: rule.kind === 'boat' ? boatWidth(key) : rule.width, height: rule.height, frames: rule.frames, kind: rule.kind });
  // Unknown keys still render as a small icon placeholder rather than crashing.
  return withFile({ key, width: 12, height: 12, frames: 1, kind: 'icon' });
}

function withFile(e: SpriteEntry): SpriteEntry {
  const file = ART_FILES[e.key];
  return file ? { ...e, file } : { ...e };
}
