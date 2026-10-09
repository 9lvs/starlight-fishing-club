// Versioned save file made of slices. Each feature owns one slice with its own
// version and migration, so adding a feature never breaks an old save. Storage
// is injected so this runs in unit tests without a browser.
import { z } from 'zod';
import type { SaveSliceDef } from '../core/feature';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StoredSlice {
  v: number;
  data: unknown;
}

export interface SaveRoot {
  version: number;
  createdAt: number;
  savedAt: number;
  slices: Record<string, StoredSlice>;
}

export const ROOT_VERSION = 1;

const rootSchema = z.object({
  version: z.number().int(),
  createdAt: z.number(),
  savedAt: z.number(),
  slices: z.record(z.string(), z.object({ v: z.number().int(), data: z.unknown() })),
});

/**
 * Root migrations, keyed by the version they upgrade FROM. v0 is the flat
 * prototype format ({ coins, savedAt, ... }) used before slices existed.
 */
export const ROOT_MIGRATIONS: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {
  0: (old) => {
    const savedAt = typeof old.savedAt === 'number' ? old.savedAt : 0;
    const slices: Record<string, StoredSlice> = {};
    if (typeof old.coins === 'number') slices.wallet = { v: 1, data: { balances: { coins: old.coins } } };
    if (old.journal && typeof old.journal === 'object') slices.journal = { v: 1, data: { entries: old.journal } };
    return { version: 1, createdAt: savedAt, savedAt, slices };
  },
};

export function migrateRoot(raw: unknown): SaveRoot {
  if (!raw || typeof raw !== 'object') throw new Error('save is not an object');
  let obj = raw as Record<string, unknown>;
  let version = typeof obj.version === 'number' ? obj.version : 0;
  if (version > ROOT_VERSION) throw new Error(`save is from a newer version (${version})`);
  while (version < ROOT_VERSION) {
    const step = ROOT_MIGRATIONS[version];
    if (!step) throw new Error(`no migration from save version ${version}`);
    obj = step(obj);
    version = typeof obj.version === 'number' ? obj.version : version + 1;
  }
  const res = rootSchema.safeParse(obj);
  if (!res.success) {
    const issue = res.error.issues[0];
    throw new Error(`save is malformed at "${issue?.path.join('.')}": ${issue?.message}`);
  }
  return res.data as SaveRoot;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Fill keys missing from `data` with defaults, recursively for plain objects. */
export function mergeDefaults<T>(defaults: T, data: unknown): T {
  if (!isPlainObject(defaults) || !isPlainObject(data)) return (data === undefined ? defaults : data) as T;
  const out: Record<string, unknown> = { ...data };
  for (const [k, dv] of Object.entries(defaults)) {
    if (!(k in out) || out[k] === undefined) out[k] = dv;
    else if (isPlainObject(dv) && isPlainObject(out[k])) out[k] = mergeDefaults(dv, out[k]);
  }
  return out as T;
}

/** Turn stored slice data into the current version's shape. */
export function materializeSlice<T>(def: SaveSliceDef<T>, stored: StoredSlice | undefined): T {
  if (!stored) return def.defaults();
  let data: unknown = stored.data;
  if (stored.v < def.version && def.migrate) data = def.migrate(data, stored.v);
  return mergeDefaults(def.defaults(), data);
}

/** FNV-1a 32-bit checksum as 8 hex chars. */
export function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export interface SaveOptions {
  storageKey: string;
  backupKeyPrefix: string;
  exportPrefix: string;
}

export interface LoadResult {
  fresh: boolean;
  /** True when the stored save was unreadable and was backed up before starting fresh. */
  recovered: boolean;
  error?: string;
}

export type ImportResult = { ok: true } | { ok: false; error: string };

export class SaveManager {
  private root: SaveRoot;
  private defs = new Map<string, SaveSliceDef>();
  private live = new Map<string, unknown>();
  private loaded = false;
  /** Set after import or reset so a pending autosave cannot overwrite the new data before reload. */
  private locked = false;

  constructor(
    private readonly storage: StorageLike,
    private readonly now: () => number,
    private readonly opts: SaveOptions,
  ) {
    this.root = this.emptyRoot();
  }

  register<T>(def: SaveSliceDef<T>): void {
    if (this.defs.has(def.key)) throw new Error(`save slice "${def.key}" is registered twice`);
    this.defs.set(def.key, def as SaveSliceDef);
    if (this.loaded) this.live.set(def.key, materializeSlice(def, this.root.slices[def.key]));
  }

  hasSlice(key: string): boolean {
    return this.defs.has(key);
  }

  load(): LoadResult {
    const text = this.storage.getItem(this.opts.storageKey);
    let result: LoadResult = { fresh: true, recovered: false };
    if (text) {
      try {
        this.root = migrateRoot(JSON.parse(text));
        result = { fresh: false, recovered: false };
      } catch (err) {
        // Never throw away a save we cannot read: keep a copy, then start fresh.
        this.storage.setItem(`${this.opts.backupKeyPrefix}unreadable`, text);
        this.root = this.emptyRoot();
        result = { fresh: true, recovered: true, error: String((err as Error).message ?? err) };
      }
    }
    for (const [key, def] of this.defs) this.live.set(key, materializeSlice(def, this.root.slices[key]));
    this.loaded = true;
    return result;
  }

  slice<T>(key: string): T {
    if (!this.live.has(key)) {
      const def = this.defs.get(key);
      if (!def) throw new Error(`unknown save slice "${key}"`);
      this.live.set(key, materializeSlice(def, this.root.slices[key]));
    }
    return this.live.get(key) as T;
  }

  /** When this save was last written. Used for offline catch-up. */
  get isLocked(): boolean {
    return this.locked;
  }

  get savedAt(): number {
    return this.root.savedAt;
  }

  get createdAt(): number {
    return this.root.createdAt;
  }

  /** Build the root that would be written, without writing it. */
  snapshot(): SaveRoot {
    const slices: Record<string, StoredSlice> = { ...this.root.slices };
    for (const [key, def] of this.defs) slices[key] = { v: def.version, data: this.live.get(key) };
    return { ...this.root, version: ROOT_VERSION, savedAt: this.now(), slices };
  }

  save(): boolean {
    if (this.locked) return false;
    try {
      const snap = this.snapshot();
      this.storage.setItem(this.opts.storageKey, JSON.stringify(snap));
      this.root = snap;
      return true;
    } catch (err) {
      console.warn('[save] could not write save', err);
      return false;
    }
  }

  exportString(): string {
    const payload = toBase64(JSON.stringify(this.snapshot()));
    return `${this.opts.exportPrefix}.${payload}.${checksum(payload)}`;
  }

  /** Decode and fully validate an export string without touching the current save. */
  validateImport(text: string): { ok: true; root: SaveRoot } | { ok: false; error: string } {
    const parts = text.trim().split('.');
    if (parts.length !== 3 || parts[0] !== this.opts.exportPrefix) {
      return { ok: false, error: 'This does not look like a Starlight save code.' };
    }
    const [, payload, sum] = parts as [string, string, string];
    if (checksum(payload) !== sum) return { ok: false, error: 'The save code is damaged (checksum mismatch).' };
    try {
      const root = migrateRoot(JSON.parse(fromBase64(payload)));
      // Dry-run every slice migration so a bad slice fails here, not after import.
      for (const [key, def] of this.defs) materializeSlice(def, root.slices[key]);
      return { ok: true, root };
    } catch (err) {
      return { ok: false, error: `The save code could not be read: ${(err as Error).message}` };
    }
  }

  /** Write an imported save to storage. The caller reloads the game afterwards. */
  importString(text: string): ImportResult {
    const res = this.validateImport(text);
    if (!res.ok) return res;
    try {
      this.storage.setItem(this.opts.storageKey, JSON.stringify(res.root));
    } catch {
      return { ok: false, error: 'Could not write the save to this browser.' };
    }
    this.locked = true;
    return { ok: true };
  }

  /** Remove the save. A backup copy is kept. The caller reloads the game afterwards. */
  reset(): void {
    const text = this.storage.getItem(this.opts.storageKey);
    if (text) this.storage.setItem(`${this.opts.backupKeyPrefix}last`, text);
    this.storage.removeItem(this.opts.storageKey);
    this.locked = true;
    this.root = this.emptyRoot();
    for (const [key, def] of this.defs) this.live.set(key, def.defaults());
  }

  private emptyRoot(): SaveRoot {
    const t = this.now();
    return { version: ROOT_VERSION, createdAt: t, savedAt: t, slices: {} };
  }
}

export class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  keys(): string[] {
    return [...this.map.keys()];
  }
}
