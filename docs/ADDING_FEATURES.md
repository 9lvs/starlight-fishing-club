# Adding Features

A feature is any gameplay system beyond the basic cast-and-reel loop: journal,
upgrades, crew, map, settings, offline summary, daily gift. Each one lives in its
own folder, implements `GameFeature` (`src/core/feature.ts`), and is listed in
`src/features/index.ts`. Nothing else in the game imports it.

## The recipe

1. **Branch.** `git switch -c feature/<name>`.
2. **Folder.** Create `src/features/<name>/` with:
   - `state.ts`: the save slice (`SaveSliceDef`) and pure rules (no Phaser).
   - `service.ts`: the logic that touches the game through `GameContext`, plus a
     module-level `set/get` pair so this feature's scenes can reach it.
   - `<Name>Scene.ts`: optional UI. Panels extend `PanelScene` (`src/scenes/PanelScene.ts`)
     and implement `build(area)`; layers are plain Phaser scenes.
   - `index.ts`: the `GameFeature` object.
3. **Talk through the core, never to other features.**
   - Events: `ctx.bus.on(...)` and `ctx.bus.emit(...)`. Add new events with declaration
     merging (see below).
   - Stats: `ctx.stats.define(...)` for new numbers, `ctx.stats.setSource(...)` for
     effects. Data can then reference your stat in upgrade `modifiers`.
   - Content: declare `contentTypes: { myType: zodSchema }` and read
     `ctx.content.extra.myType`. Files named `myType.json` in any pack are validated.
   - Save: `saveSlice` with a `version`, `defaults()`, and `migrate(old, fromVersion)`
     when you change the shape. Read it with `ctx.save.slice<T>(key)`.
   - UI: `ctx.ui.toast(...)`, `ctx.ui.openPanel(sceneKey)`, a `menuEntries` item
     (with an optional `badge`), `scenes` (`kind: 'panel'` or `'layer'`).
   - Offline: `onOfflineCatchUp(elapsedMs, ctx)` returns an `OfflineReport` for the summary.
   - Per-frame logic: `onTick(dtMs, ctx)`.
   - Debug: `debugCommands` appear in the debug panel automatically.
4. **Content that depends on the feature** (for example an upgrade that modifies your
   new stat) goes in its own pack with `"requires": ["<featureId>"]` in `pack.json`.
   The pack is skipped if the feature is removed, so the game never breaks.
5. **Register** the feature in `src/features/index.ts`.
6. **Test** the pure parts in `tests/`. Run `npm run check`, play it, merge to `main`.

To remove a feature, delete its line in `src/features/index.ts`. Its menu button,
scenes, debug commands, and dependent packs disappear, and its saved data is kept
untouched in case it returns.

## Worked example: Daily Gift

A small gift of coins once per calendar day. No streaks, nothing lost by
skipping a day. The size comes from a new stat that an upgrade can raise with JSON.
Files: `src/features/dailyGift/` and `src/content/dailygift/`.

### state.ts: save slice and pure rules

```ts
import { z } from 'zod';
import type { SaveSliceDef } from '../../core/feature';

export interface DailyGiftSlice {
  lastClaimDay: string | null; // local YYYY-MM-DD
  totalClaims: number;
}

export const dailyGiftSlice: SaveSliceDef<DailyGiftSlice> = {
  key: 'dailyGift',
  version: 1,
  defaults: () => ({ lastClaimDay: null, totalClaims: 0 }),
};

/** Gift notes live in content: src/content/<pack>/gifts.json. */
export const giftNoteSchema = z.object({ id: z.string().regex(/^[a-z0-9_]+$/), text: z.string().min(1).max(80) });
export type GiftNote = z.infer<typeof giftNoteSchema>;

export function dayKey(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function canClaim(slice: DailyGiftSlice, nowMs: number): boolean {
  return slice.lastClaimDay !== dayKey(nowMs);
}
```

### service.ts: logic through GameContext

```ts
export class DailyGiftService {
  constructor(private readonly ctx: GameContext, readonly slice: DailyGiftSlice) {}

  available(): boolean {
    return canClaim(this.slice, this.ctx.clock.now());
  }

  amount(): number {
    return Math.round(this.ctx.stats.get('dailyGiftCoins')); // a stat, so upgrades can raise it
  }

  claim(): boolean {
    if (!this.available()) return false;
    const day = dayKey(this.ctx.clock.now());
    const coins = this.amount();
    this.slice.lastClaimDay = day;
    this.slice.totalClaims += 1;
    this.ctx.wallet.add(ECONOMY.defaultCurrency, coins);
    this.ctx.bus.emit('dailyGiftClaimed', { day, coins });
    return true;
  }
}

let active: DailyGiftService | null = null;
export const setDailyGift = (s: DailyGiftService) => void (active = s);
export function getDailyGift(): DailyGiftService {
  if (!active) throw new Error('dailyGift feature is not initialised');
  return active;
}
```

### DailyGiftScene.ts: a panel

```ts
export class DailyGiftScene extends PanelScene {
  readonly title = 'Club gift';
  override readonly icon = 'icon_gift';
  constructor() {
    super('DailyGift');
  }
  protected build(area: Rect): void {
    const gift = getDailyGift();
    // ...draw text and an "Open gift" Button that calls gift.claim() then this.scene.restart()
  }
}
```

### index.ts: the feature

```ts
// New bus event by declaration merging. The core does not change.
declare module '../../core/events' {
  interface GameEvents {
    dailyGiftClaimed: { day: string; coins: number };
  }
}

export const dailyGiftFeature: GameFeature = {
  id: 'dailyGift',
  contentTypes: { gifts: giftNoteSchema },
  saveSlice: dailyGiftSlice,
  scenes: [{ key: 'DailyGift', scene: DailyGiftScene, kind: 'panel' }],
  menuEntries: [
    { id: 'dailyGift', label: 'Club gift', icon: 'icon_gift', order: 50, sceneKey: 'DailyGift',
      badge: () => getDailyGift().available() },
  ],
  init(ctx) {
    ctx.stats.define({ id: 'dailyGiftCoins', base: 60, min: 0, integer: true, label: 'Daily gift', format: 'int' });
    setDailyGift(new DailyGiftService(ctx, ctx.save.slice<DailyGiftSlice>('dailyGift')));
    ctx.bus.on('dailyGiftClaimed', ({ coins }) => ctx.ui.toast(`Opened the club gift: +${coins}`, { icon: 'icon_gift' }));
  },
  start(ctx) {
    if (getDailyGift().available()) ctx.ui.toast('A gift is waiting at the club', { icon: 'icon_gift' });
  },
  debugCommands: [
    { id: 'gift.reset', label: 'Make the gift available again', run: () => void (getDailyGift().slice.lastClaimDay = null) },
  ],
};
```

### Content pack that depends on it

```json
// src/content/dailygift/pack.json
{ "id": "dailygift", "name": "Daily Gift", "order": 0, "enabled": true, "requires": ["dailyGift"] }
```

```json
// src/content/dailygift/gifts.json
[{ "id": "cocoa", "text": "A thermos of cocoa, still warm." }]
```

```json
// src/content/dailygift/upgrades.json: a normal upgrade that modifies the feature's stat
[{ "id": "club_mailbox", "branch": "club", "name": "Club Mailbox", "description": "A bigger mailbox. Daily gifts grow.",
   "maxLevel": 4, "baseCost": 300, "costGrowth": 1.9, "icon": "icon_gift",
   "modifiers": [{ "stat": "dailyGiftCoins", "op": "add", "value": 40 }] }]
```

### Register

```ts
// src/features/index.ts
import { dailyGiftFeature } from './dailyGift';
export const FEATURES: GameFeature[] = [/* ...existing features */ dailyGiftFeature];
```

### Tests

`tests/dailyGift.test.ts` covers `dayKey`, once-per-day claiming, the stat-driven
amount, and that the feature's pack is skipped when the feature is not registered.

## Ideas this pattern is ready for

Achievements (listen to `catchLanded`, `upgradePurchased`), random events (a layer
scene plus `onTick`), aquarium or cabin decorating (creel fish + decorations),
seasons (a content pack per season with `order` and `override`), prestige (a new
currency plus a slice), cloud save (wrap `SaveManager.exportString`/`importString`).
See `docs/ROADMAP.md`.
