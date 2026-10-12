// The hand-fishing loop as a pure state machine (no Phaser), so timing rules
// are unit tested. Tap to cast, wait, tap when it bites, reel, land.
// Nothing is ever lost: a missed bite or a fish that slips away just drifts
// back to idle, and the next cast is a fresh chance.
import { randRange, type Rng } from '../../core/rng';

export type FishingPhase = 'idle' | 'casting' | 'waiting' | 'bite' | 'reeling' | 'landed' | 'missed';

export interface SessionTiming {
  castAnimMs: number;
  reelAnimMs: number;
  missMessageMs: number;
  biteGraceMs: number;
  tapDebounceMs: number;
}

export interface SessionStats {
  waitMinMs: () => number;
  waitMaxMs: () => number;
  castSpeed: () => number;
  biteWindowMs: () => number;
}

export type SessionEvent =
  | { type: 'cast' }
  | { type: 'bite'; windowMs: number }
  | { type: 'missed' }
  | { type: 'hooked'; reactionMs: number; windowMs: number }
  | { type: 'landed' }
  | { type: 'idle' }
  | { type: 'early' };

export class FishingSession {
  phase: FishingPhase = 'idle';
  /** Time spent in the current phase. Starts large so the very first tap is never debounced. */
  elapsed = Number.MAX_SAFE_INTEGER;
  /** Planned length of the current phase (0 = until something happens). */
  duration = 0;
  /** Visible bite window for the current bite. */
  biteWindow = 0;

  constructor(
    private readonly timing: SessionTiming,
    private readonly stats: SessionStats,
    private readonly rng: Rng,
    private readonly emit: (e: SessionEvent) => void,
  ) {}

  private enter(phase: FishingPhase, duration = 0): void {
    this.phase = phase;
    this.elapsed = 0;
    this.duration = duration;
  }

  /** Player tapped. Returns what the tap did. */
  tap(): SessionEvent['type'] | 'none' {
    if (this.elapsed < this.timing.tapDebounceMs && this.phase !== 'bite') return 'none';
    switch (this.phase) {
      case 'idle':
      case 'missed':
        this.cast();
        return 'cast';
      case 'waiting':
        this.emit({ type: 'early' });
        return 'early';
      case 'bite': {
        // How fast the player reacted decides the quick-catch bonus.
        const reactionMs = this.elapsed;
        this.enter('reeling', this.timing.reelAnimMs);
        this.emit({ type: 'hooked', reactionMs, windowMs: this.biteWindow });
        return 'hooked';
      }
      default:
        return 'none';
    }
  }

  private cast(): void {
    this.enter('casting', this.timing.castAnimMs);
    this.emit({ type: 'cast' });
  }

  /** The catch popup was dismissed. */
  finishLanded(): void {
    if (this.phase !== 'landed') return;
    this.enter('idle');
    this.emit({ type: 'idle' });
  }

  update(dtMs: number): void {
    this.elapsed += dtMs;
    if (this.duration <= 0 || this.elapsed < this.duration) return;
    switch (this.phase) {
      case 'casting': {
        const speed = Math.max(0.01, this.stats.castSpeed());
        const min = this.stats.waitMinMs();
        const max = Math.max(min, this.stats.waitMaxMs());
        this.enter('waiting', randRange(this.rng, min, max) / speed);
        break;
      }
      case 'waiting':
        this.biteWindow = this.stats.biteWindowMs();
        this.enter('bite', this.biteWindow + this.timing.biteGraceMs);
        this.emit({ type: 'bite', windowMs: this.biteWindow });
        break;
      case 'bite':
        this.enter('missed', this.timing.missMessageMs);
        this.emit({ type: 'missed' });
        break;
      case 'reeling':
        this.enter('landed');
        this.emit({ type: 'landed' });
        break;
      case 'missed':
        this.enter('idle');
        this.emit({ type: 'idle' });
        break;
    }
  }
}
