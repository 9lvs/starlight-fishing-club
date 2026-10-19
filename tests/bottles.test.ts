// Finds: bottles and chests come up now and then, never twice in a short
// while, and a long dry spell always ends. Each secret fish has a clue.
import { describe, expect, it } from 'vitest';
import { FINDS } from '../src/config/tuning';
import { parseContent } from '../src/core/content/parseContent';
import { seededRng } from '../src/core/rng';
import { noteSchema, pickNote, rollFind, type NoteDef } from '../src/features/journal/bottlesState';
import { readContentFiles } from './helpers/content';
import notesJson from '../src/content/bottles/notes.json';

const files = readContentFiles();
const notes = (notesJson as unknown[]).map((n) => noteSchema.parse(n));

describe('finds', () => {
  it('never come twice within the gap, and always end a dry spell', () => {
    const always = () => 0;
    expect(rollFind({ lastAt: 1000, dry: 99 }, 1000 + FINDS.minGapMs - 1, always, FINDS)).toBe(false);
    expect(rollFind({ lastAt: 0, dry: FINDS.guaranteeAfter }, 5, () => 0.99, FINDS)).toBe(true);
    expect(rollFind({ lastAt: 0, dry: 0 }, 5, () => 0.99, FINDS)).toBe(false);
  });

  it('a bottle at a water brings its clue first, then local notes, then ones from anywhere', () => {
    const rng = seededRng(3);
    expect(pickNote(notes, [], 'pond', rng)!.id).toBe('pond_hint');
    const local = pickNote(notes, ['pond_hint'], 'pond', rng)!;
    expect(local.water).toBe('pond');
    const pondNotes = notes.filter((n) => n.water === 'pond').map((n) => n.id);
    expect(pickNote(notes, pondNotes, 'pond', rng)!.water).toBeUndefined();
    expect(pickNote(notes, notes.map((n) => n.id), 'pond', rng)).toBeNull();
  });

  it('every secret fish has one clue, and every clue names a real secret fish and water', () => {
    const { content } = parseContent(files);
    const secrets = content.fish.filter((f) => f.secret);
    for (const f of secrets) expect(notes.filter((n: NoteDef) => n.hintFor === f.id)).toHaveLength(1);
    const waterIds = content.waters.map((w) => w.id);
    for (const n of notes) {
      if (n.water) expect(waterIds).toContain(n.water);
      if (n.hintFor) expect(secrets.map((f) => f.id)).toContain(n.hintFor);
    }
  });
});
