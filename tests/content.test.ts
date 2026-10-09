import { describe, expect, it } from 'vitest';
import { CORE_STATS } from '../src/config/stats';
import { PHASE_IDS } from '../src/config/time';
import { formatContentError, parseContent, validateReferences } from '../src/core/content/parseContent';
import { loadBaseContent } from './helpers/content';

const refs = { statIds: CORE_STATS.map((s) => s.id), effectIds: ['decoration'], phaseIds: PHASE_IDS };

describe('base content', () => {
  const { content, errors } = loadBaseContent();

  it('parses with no schema errors and no broken references', () => {
    expect(errors.map(formatContentError)).toEqual([]);
    expect(validateReferences(content, refs).map(formatContentError)).toEqual([]);
  });

  it('has at least 30 fish across the three starter waters with a good rarity spread', () => {
    expect(content.fish.length).toBeGreaterThanOrEqual(30);
    for (const w of ['pond', 'river', 'cove']) {
      const inWater = content.fish.filter((f) => f.waters.includes(w));
      expect(new Set(inWater.map((f) => f.rarity))).toEqual(new Set(['common', 'uncommon', 'rare', 'epic', 'legendary']));
    }
    expect(content.fish.some((f) => f.timeOfDay.length > 0)).toBe(true);
    expect(content.fish.some((f) => f.weather.length > 0)).toBe(true);
  });

  it('shows two coming-soon waters', () => {
    expect(content.waters.filter((w) => w.comingSoon).map((w) => w.id)).toEqual(['glowing_cave', 'sky_lake']);
  });
});

describe('schema validation errors', () => {
  const rarity = { id: 'common', name: 'Common', tier: 0, weight: 1, baseValue: 1, color: 'slate', frame: 'dusk', pips: 1, shape: 'circle' };

  it('names the file, entry id, and field', () => {
    const { errors } = parseContent({
      '../../content/test/rarities.json': [rarity],
      '../../content/test/fish.json': [
        { id: 'bad_fish', name: 'Bad', rarity: 'common', waters: ['pond'], baseValue: 'lots', spriteKey: 'x', description: 'd' },
      ],
    });
    expect(errors).toHaveLength(1);
    const msg = formatContentError(errors[0]!);
    expect(msg).toContain('test/fish.json');
    expect(msg).toContain('entry "bad_fish"');
    expect(msg).toContain('field "baseValue"');
  });

  it('reports unknown content types and non-array files', () => {
    const { errors } = parseContent({
      '../../content/test/fishies.json': [],
      '../../content/test/fish.json': { not: 'an array' },
    });
    expect(errors.map((e) => e.message).join('\n')).toMatch(/unknown content type "fishies"/);
    expect(errors.map((e) => e.message).join('\n')).toMatch(/JSON array/);
  });

  it('rejects duplicate ids unless the later pack overrides on purpose', () => {
    const files = {
      '../../content/base/rarities.json': [rarity],
      '../../content/winter/rarities.json': [{ ...rarity, name: 'Frosty' }],
    };
    expect(parseContent(files).errors[0]!.message).toMatch(/duplicate id/);
    const ok = parseContent({ ...files, '../../content/winter/rarities.json': [{ ...rarity, name: 'Frosty', override: true }] });
    expect(ok.errors).toEqual([]);
    expect(ok.content.rarities[0]!.name).toBe('Frosty');
  });

  it('skips disabled packs and loads packs in order', () => {
    const { content } = parseContent({
      '../../content/base/rarities.json': [rarity],
      '../../content/off/pack.json': { id: 'off', name: 'Off', enabled: false },
      '../../content/off/rarities.json': [{ ...rarity, id: 'nope', tier: 9 }],
    });
    expect(content.rarities.map((r) => r.id)).toEqual(['common']);
  });

  it('catches broken references across files', () => {
    const { content } = loadBaseContent();
    const broken = { ...content, fish: [...content.fish, { ...content.fish[0]!, id: 'lost', rarity: 'mythic', waters: ['nowhere'] }] };
    const errs = validateReferences(broken, refs).map(formatContentError).join('\n');
    expect(errs).toMatch(/unknown rarity "mythic"/);
    expect(errs).toMatch(/unknown water "nowhere"/);
  });
});
