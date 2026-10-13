// Composes background music one bar at a time: a slow chord pad, a soft bass
// note, and a sparse melody drawn from the pentatonic scale. Pure logic (no
// Web Audio), so it is easy to test and the player only schedules notes.
import type { MusicMood, MusicVoice } from '../config/audio';

export interface MusicConfig {
  beatsPerBar: number;
  barsPerChord: number;
  progression: [number, number[]][];
  scale: number[];
  restEvery: number;
}

export interface MusicNote {
  /** Start, in beats from the start of the bar. */
  at: number;
  /** MIDI note number. */
  midi: number;
  /** Length in beats. */
  beats: number;
  voice: 'pad' | 'bass' | MusicVoice;
  /** 0..1 loudness within its voice. */
  velocity: number;
}

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Scale notes within an octave and a half of the register, nearest first. */
export function melodyPool(register: number, scale: readonly number[]): number[] {
  const pool: number[] = [];
  for (let m = register - 7; m <= register + 9; m++) if (scale.includes(((m % 12) + 12) % 12)) pool.push(m);
  return pool;
}

export function composeBar(bar: number, mood: MusicMood, rng: () => number, cfg: MusicConfig): MusicNote[] {
  const notes: MusicNote[] = [];
  const chordIndex = Math.floor(bar / cfg.barsPerChord) % cfg.progression.length;
  const [root, pad] = cfg.progression[chordIndex]!;
  const firstOfChord = bar % cfg.barsPerChord === 0;
  const bars = cfg.barsPerChord * cfg.beatsPerBar;
  // Pads and bass sound once per chord and ring through it.
  if (firstOfChord) {
    for (const m of pad) notes.push({ at: 0, midi: m, beats: bars, voice: 'pad', velocity: 1 });
    notes.push({ at: 0, midi: root, beats: cfg.beatsPerBar * 1.5, voice: 'bass', velocity: 1 });
  } else {
    notes.push({ at: 0, midi: root + 7, beats: cfg.beatsPerBar, voice: 'bass', velocity: 0.6 });
  }
  // Melody on half beats, chord tones favoured on strong beats.
  const pool = melodyPool(mood.register, cfg.scale);
  const chordPcs = new Set(pad.map((m) => m % 12));
  const resting = cfg.restEvery > 0 && bar % cfg.restEvery === cfg.restEvery - 1;
  const density = resting ? mood.density * 0.3 : mood.density;
  let prev = mood.register;
  for (let half = 0; half < cfg.beatsPerBar * 2; half++) {
    if (rng() >= density) continue;
    const strong = half % 2 === 0;
    const choices = strong ? pool.filter((m) => chordPcs.has(m % 12)) : pool;
    const near = choices.filter((m) => Math.abs(m - prev) <= 5);
    const from = near.length > 0 ? near : choices;
    const midi = from[Math.floor(rng() * from.length)]!;
    prev = midi;
    notes.push({ at: half / 2, midi, beats: mood.voice === 'bell' || mood.voice === 'harp' ? 3 : 1.5, voice: mood.voice, velocity: strong ? 1 : 0.7 });
  }
  return notes;
}
