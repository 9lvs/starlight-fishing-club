// Stat and modifier pipeline. Nothing in the game hardcodes an upgrade effect:
// upgrades, bait, decorations, and features add modifiers with a source id, and
// the final value is computed here.
//
// Order: modifiers are sorted by priority (ascending, default 0). Within the same
// priority, "set" runs first, then "add", then "mult", then insertion order.
// The result is clamped to the stat's min/max and rounded if the stat is an integer.

export type ModifierOp = 'add' | 'mult' | 'set';

export interface Modifier {
  stat: string;
  op: ModifierOp;
  value: number;
  priority?: number;
  /** Who added it, e.g. "upgrade:rod_grip". Used to remove or replace a group. */
  source: string;
}

export type StatFormat = 'int' | 'ms' | 'mult' | 'percent' | 'hours' | 'number';

export interface StatDef {
  id: string;
  base: number;
  min?: number;
  max?: number;
  integer?: boolean;
  label?: string;
  format?: StatFormat;
}

const OP_ORDER: Record<ModifierOp, number> = { set: 0, add: 1, mult: 2 };

/** Pure pipeline: apply modifiers to a base value. Exported for tests and previews. */
export function computeStat(def: StatDef, modifiers: readonly Modifier[]): number {
  const ordered = modifiers
    .map((m, index) => ({ m, index }))
    .sort(
      (a, b) =>
        (a.m.priority ?? 0) - (b.m.priority ?? 0) ||
        OP_ORDER[a.m.op] - OP_ORDER[b.m.op] ||
        a.index - b.index,
    );
  let value = def.base;
  for (const { m } of ordered) {
    if (m.op === 'set') value = m.value;
    else if (m.op === 'add') value += m.value;
    else value *= m.value;
  }
  if (def.min !== undefined) value = Math.max(def.min, value);
  if (def.max !== undefined) value = Math.min(def.max, value);
  if (def.integer) value = Math.round(value);
  return value;
}

/**
 * Scale a per-level modifier to a level. Upgrade data describes one level;
 * "add" stacks linearly, "mult" compounds, "set" ignores level.
 */
export function modifierAtLevel(mod: Omit<Modifier, 'source'>, level: number): Omit<Modifier, 'source'> {
  if (level <= 0) return { ...mod, value: mod.op === 'mult' ? 1 : 0 };
  if (mod.op === 'add') return { ...mod, value: mod.value * level };
  if (mod.op === 'mult') return { ...mod, value: Math.pow(mod.value, level) };
  return { ...mod };
}

export class StatsService {
  private defs = new Map<string, StatDef>();
  private mods = new Map<string, Modifier[]>();
  private cache = new Map<string, number>();
  private pendingChanged = new Set<string>();
  private batchDepth = 0;

  constructor(private readonly onChanged: (statIds: string[]) => void = () => {}) {}

  define(def: StatDef): void {
    if (this.defs.has(def.id)) throw new Error(`Stat "${def.id}" is already defined`);
    this.defs.set(def.id, def);
    this.markChanged(def.id);
  }

  has(id: string): boolean {
    return this.defs.has(id);
  }

  ids(): string[] {
    return [...this.defs.keys()];
  }

  def(id: string): StatDef {
    const d = this.defs.get(id);
    if (!d) throw new Error(`Unknown stat "${id}"`);
    return d;
  }

  get(id: string): number {
    const cached = this.cache.get(id);
    if (cached !== undefined) return cached;
    const value = computeStat(this.def(id), this.mods.get(id) ?? []);
    this.cache.set(id, value);
    return value;
  }

  /** Value without any modifiers. */
  base(id: string): number {
    return this.def(id).base;
  }

  modifiersFor(id: string): readonly Modifier[] {
    return this.mods.get(id) ?? [];
  }

  addModifier(mod: Modifier): void {
    this.def(mod.stat); // throws a clear error for unknown stats
    const list = this.mods.get(mod.stat) ?? [];
    list.push(mod);
    this.mods.set(mod.stat, list);
    this.markChanged(mod.stat);
  }

  addModifiers(mods: readonly Modifier[]): void {
    this.batch(() => mods.forEach((m) => this.addModifier(m)));
  }

  removeSource(source: string): void {
    this.batch(() => {
      for (const [stat, list] of this.mods) {
        const kept = list.filter((m) => m.source !== source);
        if (kept.length !== list.length) {
          this.mods.set(stat, kept);
          this.markChanged(stat);
        }
      }
    });
  }

  /** Replace every modifier from a source in one change notification. */
  setSource(source: string, mods: readonly Omit<Modifier, 'source'>[]): void {
    this.batch(() => {
      this.removeSource(source);
      for (const m of mods) this.addModifier({ ...m, source });
    });
  }

  /** Preview a stat as if extra modifiers were applied (for upgrade tooltips). */
  preview(id: string, extra: readonly Modifier[], withoutSource?: string): number {
    const current = (this.mods.get(id) ?? []).filter((m) => m.source !== withoutSource);
    return computeStat(this.def(id), [...current, ...extra.filter((m) => m.stat === id)]);
  }

  batch(fn: () => void): void {
    this.batchDepth++;
    try {
      fn();
    } finally {
      this.batchDepth--;
      if (this.batchDepth === 0) this.flush();
    }
  }

  private markChanged(id: string): void {
    this.cache.delete(id);
    this.pendingChanged.add(id);
    if (this.batchDepth === 0) this.flush();
  }

  private flush(): void {
    if (this.pendingChanged.size === 0) return;
    const ids = [...this.pendingChanged];
    this.pendingChanged.clear();
    this.onChanged(ids);
  }
}

export function formatStat(def: StatDef, value: number): string {
  switch (def.format) {
    case 'ms':
      return `${(value / 1000).toFixed(2).replace(/\.?0+$/, '')}s`;
    case 'mult':
      return `x${value.toFixed(2).replace(/\.?0+$/, '')}`;
    case 'percent':
      return `${Math.round(value * 100)}%`;
    case 'hours':
      return `${Math.round(value * 10) / 10}h`;
    case 'int':
      return `${Math.round(value)}`;
    default:
      return `${Math.round(value * 100) / 100}`;
  }
}
