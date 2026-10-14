// Pure content parsing and validation. Takes raw JSON modules keyed by path and
// returns typed content plus readable errors. No Vite or Phaser imports here, so
// it runs in unit tests.
import type { ZodType } from 'zod';
import { CORE_CONTENT_SCHEMAS, packSchema, type CoreContent, type PackDef } from './schemas';

export interface ContentError {
  file: string;
  entryId?: string;
  index?: number;
  field?: string;
  message: string;
}

export interface ParsedContent extends CoreContent {
  packs: PackDef[];
  /** Content types registered by features, keyed by type name. */
  extra: Record<string, unknown[]>;
  /** "type:id" -> file the entry came from, for error messages later. */
  sources: Map<string, string>;
}

export interface ParseResult {
  content: ParsedContent;
  errors: ContentError[];
}

export function formatContentError(e: ContentError): string {
  const where = [e.file];
  if (e.entryId) where.push(`entry "${e.entryId}"`);
  else if (e.index !== undefined) where.push(`entry #${e.index}`);
  if (e.field) where.push(`field "${e.field}"`);
  return `${where.join(' > ')}: ${e.message}`;
}

interface FileInfo {
  path: string;
  short: string; // "base/fish.json"
  pack: string;
  type: string;
}

function describeFile(path: string): FileInfo | null {
  const m = /([^/]+)\/([^/]+)\.json$/.exec(path);
  if (!m || !m[1] || !m[2]) return null;
  const pack = m[1];
  const base = m[2];
  const type = base.split('.')[0] ?? base;
  return { path, short: `${pack}/${base}.json`, pack, type };
}

function emptyContent(): ParsedContent {
  return {
    rarities: [],
    fish: [],
    waters: [],
    branches: [],
    upgrades: [],
    crew: [],
    weather: [],
    decorations: [],
    currencies: [],
    packs: [],
    extra: {},
    sources: new Map(),
  };
}

export function parseContent(
  files: Record<string, unknown>,
  extraSchemas: Record<string, ZodType> = {},
  /** Registered feature ids; packs that require a missing feature are skipped. Undefined skips the check. */
  featureIds?: readonly string[],
): ParseResult {
  const errors: ContentError[] = [];
  const content = emptyContent();
  const infos = Object.keys(files)
    .map(describeFile)
    .filter((f): f is FileInfo => f !== null);

  // Packs first, so disabled packs can be skipped and order applied.
  const packDefs = new Map<string, PackDef>();
  for (const info of infos.filter((f) => f.type === 'pack')) {
    const res = packSchema.safeParse(files[info.path]);
    if (!res.success) {
      for (const issue of res.error.issues) {
        errors.push({ file: info.short, field: issue.path.join('.'), message: issue.message });
      }
      continue;
    }
    packDefs.set(info.pack, res.data);
  }
  const packOf = (name: string): PackDef =>
    packDefs.get(name) ?? { id: name, name, order: name === 'base' ? -1000 : 0, enabled: true, requires: [] };
  const available = (p: PackDef) => !featureIds || p.requires.every((f) => featureIds.includes(f));

  const packNames = [...new Set(infos.map((f) => f.pack))]
    .map(packOf)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  content.packs = packNames.filter((p) => p.enabled && available(p));
  const enabledPacks = new Set(content.packs.map((p) => p.id));

  const ordered = infos
    .filter((f) => f.type !== 'pack' && enabledPacks.has(f.pack))
    .sort(
      (a, b) =>
        content.packs.findIndex((p) => p.id === a.pack) - content.packs.findIndex((p) => p.id === b.pack) ||
        a.short.localeCompare(b.short),
    );

  const schemas: Record<string, ZodType> = { ...CORE_CONTENT_SCHEMAS, ...extraSchemas };

  for (const info of ordered) {
    const schema = schemas[info.type];
    if (!schema) {
      errors.push({
        file: info.short,
        message: `unknown content type "${info.type}". File names must start with one of: ${Object.keys(schemas).join(', ')}`,
      });
      continue;
    }
    const raw = files[info.path];
    if (!Array.isArray(raw)) {
      errors.push({ file: info.short, message: 'content files must contain a JSON array of entries' });
      continue;
    }
    const target = targetList(content, info.type);
    raw.forEach((entry: unknown, index: number) => {
      const entryId = typeof (entry as { id?: unknown })?.id === 'string' ? (entry as { id: string }).id : undefined;
      const override = (entry as { override?: unknown })?.override === true;
      const clean = override ? stripOverride(entry) : entry;
      const res = schema.safeParse(clean);
      if (!res.success) {
        for (const issue of res.error.issues) {
          errors.push({
            file: info.short,
            entryId,
            index,
            field: issue.path.join('.') || undefined,
            message: issue.message,
          });
        }
        return;
      }
      const parsed = res.data as { id: string };
      const key = `${info.type}:${parsed.id}`;
      const existingAt = target.findIndex((e) => (e as { id: string }).id === parsed.id);
      if (existingAt >= 0) {
        if (override) {
          target[existingAt] = parsed;
          content.sources.set(key, info.short);
        } else {
          errors.push({
            file: info.short,
            entryId: parsed.id,
            index,
            field: 'id',
            message: `duplicate id, already defined in ${content.sources.get(key)}. Add "override": true to replace it on purpose.`,
          });
        }
        return;
      }
      target.push(parsed);
      content.sources.set(key, info.short);
    });
  }

  applyWaterValues(content);
  return { content, errors };
}

/**
 * Fish are priced on the starting water's scale in fish.json; each water's
 * fishValue multiplies the fish that live there (by their first listed
 * water), so later waters pay more without retyping every price.
 */
function applyWaterValues(content: ParsedContent): void {
  const mult = new Map(content.waters.map((w) => [w.id, w.fishValue]));
  content.fish = content.fish.map((f) => {
    const m = mult.get(f.waters[0] ?? '') ?? 1;
    return m === 1 ? f : { ...f, baseValue: Math.round(f.baseValue * m * 100) / 100 };
  });
}

function stripOverride(entry: unknown): unknown {
  const { override: _drop, ...rest } = entry as Record<string, unknown>;
  return rest;
}

function targetList(content: ParsedContent, type: string): unknown[] {
  if (type in CORE_CONTENT_SCHEMAS) return content[type as keyof CoreContent] as unknown[];
  const list = content.extra[type] ?? [];
  content.extra[type] = list;
  return list;
}

export interface ReferenceContext {
  statIds: readonly string[];
  effectIds: readonly string[];
  phaseIds: readonly string[];
}

/** Cross-file checks that a single schema cannot do: does every referenced id exist? */
export function validateReferences(content: ParsedContent, ctx: ReferenceContext): ContentError[] {
  const errors: ContentError[] = [];
  const src = (type: string, entryId: string) => content.sources.get(`${type}:${entryId}`) ?? type;
  const ids = (list: { id: string }[]) => new Set(list.map((e) => e.id));
  const rarities = ids(content.rarities);
  const waters = ids(content.waters);
  const weather = ids(content.weather);
  const branches = ids(content.branches);
  const currencies = ids(content.currencies);
  const upgrades = ids(content.upgrades);
  const stats = new Set(ctx.statIds);
  const effects = new Set(ctx.effectIds);
  const phases = new Set(ctx.phaseIds);

  const need = (cond: boolean, type: string, entryId: string, field: string, message: string) => {
    if (!cond) errors.push({ file: src(type, entryId), entryId, field, message });
  };

  if (content.rarities.length === 0) errors.push({ file: 'rarities', message: 'at least one rarity is required' });
  if (content.currencies.length === 0) errors.push({ file: 'currencies', message: 'at least one currency is required' });
  const tiers = new Set<number>();
  for (const r of content.rarities) {
    need(!tiers.has(r.tier), 'rarities', r.id, 'tier', `tier ${r.tier} is used by more than one rarity`);
    tiers.add(r.tier);
  }

  for (const f of content.fish) {
    need(rarities.has(f.rarity), 'fish', f.id, 'rarity', `unknown rarity "${f.rarity}"`);
    f.waters.forEach((w, i) => need(waters.has(w), 'fish', f.id, `waters.${i}`, `unknown water "${w}"`));
    f.timeOfDay.forEach((t, i) =>
      need(phases.has(t), 'fish', f.id, `timeOfDay.${i}`, `unknown time of day "${t}" (use ${[...phases].join(', ')})`),
    );
    f.weather.forEach((w, i) => need(weather.has(w), 'fish', f.id, `weather.${i}`, `unknown weather "${w}"`));
    if (f.size) need(f.size[0] <= f.size[1], 'fish', f.id, 'size', 'size must be [min, max] with min <= max');
  }

  for (const u of content.upgrades) {
    need(branches.has(u.branch), 'upgrades', u.id, 'branch', `unknown branch "${u.branch}"`);
    if (u.currency) need(currencies.has(u.currency), 'upgrades', u.id, 'currency', `unknown currency "${u.currency}"`);
    u.prerequisites.forEach((p, i) => {
      const pid = typeof p === 'string' ? p : p.id;
      need(upgrades.has(pid), 'upgrades', u.id, `prerequisites.${i}`, `unknown upgrade "${pid}"`);
      need(pid !== u.id, 'upgrades', u.id, `prerequisites.${i}`, 'an upgrade cannot require itself');
    });
    u.modifiers.forEach((m, i) => need(stats.has(m.stat), 'upgrades', u.id, `modifiers.${i}.stat`, `unknown stat "${m.stat}"`));
    u.effects.forEach((e, i) =>
      need(effects.has(e.handler), 'upgrades', u.id, `effects.${i}.handler`, `unknown effect handler "${e.handler}"`),
    );
  }

  for (const c of content.crew) {
    if (c.currency) need(currencies.has(c.currency), 'crew', c.id, 'currency', `unknown currency "${c.currency}"`);
  }

  // Every playable water needs at least one fish that is always available, so a
  // cast can never come up empty.
  for (const w of content.waters.filter((x) => !x.comingSoon)) {
    const always = content.fish.some((f) => f.waters.includes(w.id) && f.timeOfDay.length === 0 && f.weather.length === 0);
    need(always, 'waters', w.id, 'id', 'needs at least one fish with no time of day or weather restriction');
  }

  return errors;
}
