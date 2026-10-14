// The getting-started guide and the one-time tips, as data. Anchors say what a
// bubble points at; the scene turns them into screen positions.

export type TipAnchor =
  | { kind: 'cast' }
  | { kind: 'bobber' }
  | { kind: 'creel' }
  | { kind: 'menu'; entry: string }
  | { kind: 'center' };

export interface TipDef {
  id: string;
  text: string;
  anchor: TipAnchor;
  /** Tapping the bubble hides it. Off for tips whose action is a tap on the world. */
  dismissable: boolean;
  /** Opening this panel counts as following the tip. */
  opens?: string;
  /** Hide on its own after this long. */
  autoHideMs?: number;
}

/** Shown in order to new players. Each step ends on its event (see service.ts). */
export const GUIDE: TipDef[] = [
  { id: 'cast', text: 'Tap Cast, or anywhere on the water, to throw your line.', anchor: { kind: 'cast' }, dismissable: false },
  { id: 'wait', text: 'Watch the bobber. When it dips and "!" pops up, tap to reel in!', anchor: { kind: 'bobber' }, dismissable: false },
  {
    id: 'shop',
    text: 'Coins buy upgrades. Tap the star, pick a glowing tier, then Buy. Better rods bring rarer fish.',
    anchor: { kind: 'menu', entry: 'upgrades' },
    dismissable: true,
  },
  { id: 'done', text: 'You are all set. Fish at your own pace. Tap a tip to hide it.', anchor: { kind: 'center' }, dismissable: true, autoHideMs: 6000 },
];

/** One-time tips that appear when they become useful. */
export const TIPS: Record<string, TipDef> = {
  creel: {
    id: 'creel',
    text: 'Kept fish wait in your creel. Sell together for a bonus, and more for 3, 5, or 10 of a rarity. Fresher fish sell for more.',
    anchor: { kind: 'creel' },
    dismissable: true,
    opens: 'Creel',
  },
  crew: {
    id: 'crew',
    text: 'A crew bunk is ready! Hire a helper. While you are away, crew fill your creel.',
    anchor: { kind: 'menu', entry: 'crew' },
    dismissable: true,
    opens: 'Crew',
  },
  gems: {
    id: 'gems',
    text: 'You found a gem! Gems buy looks in the Club tab, and they stay when the club moves.',
    anchor: { kind: 'menu', entry: 'upgrades' },
    dismissable: true,
    opens: 'Upgrades',
  },
  move: {
    id: 'move',
    text: 'Your boat can reach a new water! Moving the club starts fresh with a bigger coin bonus.',
    anchor: { kind: 'menu', entry: 'map' },
    dismissable: true,
    opens: 'Map',
  },
  tackle: {
    id: 'tackle',
    text: 'Some fish slip away, rare ones more often. Rods, boats, and bait add Tackle so you land them.',
    anchor: { kind: 'menu', entry: 'upgrades' },
    dismissable: true,
    opens: 'Upgrades',
  },
  glow: {
    id: 'glow',
    text: 'A glow in the water means a rarer fish is near: blue rare, purple epic, gold legendary.',
    anchor: { kind: 'bobber' },
    dismissable: false,
    autoHideMs: 7000,
  },
  fight: {
    id: 'fight',
    text: 'Rare fish fight back! Tap when the bobber dips. A clean fight pays more. Easy reel in Settings makes it one tap.',
    anchor: { kind: 'bobber' },
    dismissable: false,
    autoHideMs: 7000,
  },
  weather: {
    id: 'weather',
    text: 'The weather changed! Some fish only bite in wind, rain, storms, or fog. Check the Journal.',
    anchor: { kind: 'center' },
    dismissable: true,
    autoHideMs: 8000,
  },
  daily: {
    id: 'daily',
    text: 'Try the Daily Catch: one fish for everyone today, and your first five catches make a luck score to share.',
    anchor: { kind: 'menu', entry: 'dailyCatch' },
    dismissable: true,
    opens: 'DailyCatch',
  },
};

/** Hand catches before the Daily Catch tip appears. */
export const DAILY_TIP_AFTER = 8;
