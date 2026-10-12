// Composed music: in key, gentle, sparser at night, and resting every few bars.
import { describe, expect, it } from 'vitest';
import { MUSIC } from '../src/config/audio';
import { seededRng } from '../src/core/rng';
import { composeBar, melodyPool, midiToHz } from '../src/systems/musicComposer';

describe('music composer', () => {
  it('keeps every melody note in the pentatonic scale', () => {
    const rng = seededRng(4);
    for (let bar = 0; bar < 64; bar++) {
      for (const n of composeBar(bar, MUSIC.moods.day!, rng, MUSIC)) {
        if (n.voice === 'pluck' || n.voice === 'bell') expect(MUSIC.scale).toContain(n.midi % 12);
      }
    }
  });

  it('sounds a chord and a bass note at the start of every chord', () => {
    const notes = composeBar(0, MUSIC.moods.day!, seededRng(1), MUSIC);
    expect(notes.filter((n) => n.voice === 'pad')).toHaveLength(MUSIC.progression[0]![1].length);
    expect(notes.some((n) => n.voice === 'bass' && n.at === 0)).toBe(true);
  });

  it('plays fewer notes at night, with the music-box voice', () => {
    const count = (phase: string) => {
      const rng = seededRng(9);
      let n = 0;
      for (let bar = 0; bar < 200; bar++) n += composeBar(bar, MUSIC.moods[phase]!, rng, MUSIC).filter((x) => x.voice !== 'pad' && x.voice !== 'bass').length;
      return n;
    };
    expect(count('night')).toBeLessThan(count('day'));
    expect(composeBar(0, MUSIC.moods.night!, () => 0, MUSIC).some((n) => n.voice === 'bell')).toBe(true);
  });

  it('builds a melody pool around the register and converts notes to pitch', () => {
    expect(melodyPool(72, MUSIC.scale).every((m) => Math.abs(m - 72) <= 9)).toBe(true);
    expect(midiToHz(69)).toBeCloseTo(440);
  });
});
