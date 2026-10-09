// Every sound the game plays, by key. To add real audio, drop files into
// public/audio/ and list them in `files` (first playable format wins; ship .ogg
// and .mp3 for Safari). Until a file exists, `placeholder` decides what plays:
// a soft synthesized tone ('synth') or nothing ('silent').

export type Placeholder = 'synth' | 'silent';

export interface ToneSpec {
  /** Frequencies in Hz, played one after another. */
  notes: number[];
  wave: 'sine' | 'triangle';
  noteMs: number;
  gapMs: number;
  gain: number;
}

export interface SoundDef {
  files?: string[];
  volume: number;
  loop?: boolean;
  tone?: ToneSpec;
  /** Ambient bed made of filtered noise, used when no file exists. */
  ambient?: { filterHz: number; gain: number; swellHz: number };
}

export const AUDIO = {
  placeholder: 'synth' as Placeholder,
  masterDefault: 0.7,
  /** Never louder than this, even at 100% volume. Keeps the game calm. */
  masterCeiling: 0.6,
};

// Pentatonic notes keep every placeholder gentle and in key.
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880.0;
const C6 = 1046.5;
const G4 = 392.0;

export const SOUNDS: Record<string, SoundDef> = {
  ambient: { volume: 0.5, loop: true, ambient: { filterHz: 420, gain: 0.05, swellHz: 0.07 } },
  cast: { volume: 0.5, tone: { notes: [G4, C5], wave: 'sine', noteMs: 90, gapMs: 20, gain: 0.08 } },
  bite: { volume: 0.6, tone: { notes: [E5, E5], wave: 'triangle', noteMs: 70, gapMs: 60, gain: 0.08 } },
  reel: { volume: 0.5, tone: { notes: [C5, D5, E5], wave: 'sine', noteMs: 60, gapMs: 10, gain: 0.06 } },
  catch: { volume: 0.6, tone: { notes: [C5, G5], wave: 'sine', noteMs: 140, gapMs: 30, gain: 0.08 } },
  coin: { volume: 0.4, tone: { notes: [A5, C6], wave: 'sine', noteMs: 60, gapMs: 10, gain: 0.05 } },
  purchase: { volume: 0.5, tone: { notes: [C5, E5, G5], wave: 'sine', noteMs: 90, gapMs: 15, gain: 0.07 } },
  unlock: { volume: 0.6, tone: { notes: [C5, E5, G5, C6], wave: 'sine', noteMs: 140, gapMs: 30, gain: 0.07 } },
  ui_click: { volume: 0.3, tone: { notes: [G5], wave: 'sine', noteMs: 30, gapMs: 0, gain: 0.04 } },
  sting_common: { volume: 0.4, tone: { notes: [C5], wave: 'sine', noteMs: 120, gapMs: 0, gain: 0.05 } },
  sting_uncommon: { volume: 0.5, tone: { notes: [C5, E5], wave: 'sine', noteMs: 120, gapMs: 20, gain: 0.06 } },
  sting_rare: { volume: 0.55, tone: { notes: [C5, E5, G5], wave: 'triangle', noteMs: 130, gapMs: 20, gain: 0.06 } },
  sting_epic: { volume: 0.6, tone: { notes: [C5, E5, G5, A5], wave: 'triangle', noteMs: 140, gapMs: 25, gain: 0.06 } },
  sting_legendary: { volume: 0.65, tone: { notes: [C5, E5, G5, C6, G5, C6], wave: 'triangle', noteMs: 150, gapMs: 30, gain: 0.07 } },
};
