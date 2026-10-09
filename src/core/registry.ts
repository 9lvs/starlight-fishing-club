// Generic id-keyed registry. Fish, waters, rarities, currencies, weather, upgrades,
// crew types, decorations, and effect handlers each live in one of these.

export interface Identified {
  id: string;
}

export class Registry<T extends Identified> {
  private items = new Map<string, T>();

  constructor(readonly kind: string) {}

  register(item: T, opts: { override?: boolean } = {}): T {
    if (this.items.has(item.id) && !opts.override) {
      throw new Error(`${this.kind} "${item.id}" is already registered`);
    }
    this.items.set(item.id, item);
    return item;
  }

  registerAll(items: Iterable<T>, opts: { override?: boolean } = {}): void {
    for (const item of items) this.register(item, opts);
  }

  get(id: string): T {
    const item = this.items.get(id);
    if (!item) throw new Error(`Unknown ${this.kind} "${id}"`);
    return item;
  }

  tryGet(id: string): T | undefined {
    return this.items.get(id);
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  /** All entries in registration order. */
  list(): T[] {
    return [...this.items.values()];
  }

  ids(): string[] {
    return [...this.items.keys()];
  }

  get size(): number {
    return this.items.size;
  }

  remove(id: string): boolean {
    return this.items.delete(id);
  }
}
