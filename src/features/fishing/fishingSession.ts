// The hand-fishing loop as a pure state machine (no Phaser), so timing rules
// are unit tested. Tap to cast, wait, tap when it bites, reel, land. Rare fish
// fight first: tap each dip, and hold at the end for a legendary.
// Nothing is ever lost: a missed bite or a fish that slips away just drifts
// back to idle, and the next cast is a fresh chance.
import { randRange, type Rng } from '../../core/rng';

export type FishingPhase = 'idle' | 'casting' | 'waiting' | 'bite' | 'fight' | 'reeling' | 'landed' | 'missed';

export interface FightTiming {
  dipMs: number;
  gapMinMs: number;
  gapMaxMs: number;
  graceMs: number;
  holdMs: number;
  holdMaxMs: number;
}

export interface FightState {
  dips: number;
  hold: boolean;
  index: number;
  hits: number;
  stage: 'gap' | 'dip' | 'hold';
  stageMs: number;
  gapMs: number;
  holding: boolean;
  heldMs: number;
}

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
  | { type: 'early' }
  | { type: 'fightStart'; dips: number; hold: boolean }
  | { type: 'dip'; index: number; windowMs: number }
  | { type: 'dipHit'; index: number }
  | { type: 'dipMiss'; index: number; fumble: boolean }
  | { type: 'hold'; holdMs: number }
  | { type: 'fightDone'; hits: number; dips: number; hold: boolean; held: boolean };

export class FishingSession {
  phase: FishingPhase = 'idle';
  /** Time spent in the current phase. Starts large so the very first tap is never debounced. */
  elapsed = Number.MAX_SAFE_INTEGER;
  /** Planned length of the current phase (0 = until something happens). */
  duration = 0;
  /** Visible bite window for the current bite. */
  biteWindow = 0;
  /** The fight with a rare fish, while phase is 'fight'. */
  fight: FightState | null = null;

  constructor(
    private readonly timing: SessionTiming,
    private readonly stats: SessionStats,
    private readonly rng: Rng,
    private readonly emit: (e: SessionEvent) => void,
    private readonly fightTiming?: FightTiming,
  ) {}

  /** Called right after 'hooked' for a fish that fights: dips to tap, then maybe a hold. */
  startFight(dips: number, hold: boolean): void {
    if (this.phase !== 'reeling' || !this.fightTiming || (dips <= 0 && !hold)) return;
    this.enter('fight');
    this.fight = { dips, hold, index: 0, hits: 0, stage: 'gap', stageMs: 0, gapMs: this.fightTiming.gapMaxMs, holding: false, heldMs: 0 };
    this.emit({ type: 'fightStart', dips, hold });
    if (dips === 0) this.startHold();
  }

  /** Slow the reel-in down (the legendary leap). */
  stretchReel(mult: number): void {
    if (this.phase === 'reeling') this.duration *= mult;
  }

  /** Finger lifted or key released: only matters while holding a legendary. */
  release(): void {
    if (this.fight) this.fight.holding = false;
  }

  private nextGap(): number {
    const t = this.fightTiming!;
    return randRange(this.rng, t.gapMinMs, t.gapMaxMs);
  }

  private advanceDip(): void {
    const f = this.fight!;
    f.index += 1;
    if (f.index < f.dips) {
      f.stage = 'gap';
      f.stageMs = 0;
      f.gapMs = this.nextGap();
    } else if (f.hold) this.startHold();
    else this.endFight(false);
  }

  private startHold(): void {
    const f = this.fight!;
    f.stage = 'hold';
    f.stageMs = 0;
    f.holding = false;
    this.emit({ type: 'hold', holdMs: this.fightTiming!.holdMs });
  }

  private endFight(held: boolean): void {
    const f = this.fight!;
    this.fight = null;
    this.enter('reeling', this.timing.reelAnimMs);
    this.emit({ type: 'fightDone', hits: f.hits, dips: f.dips, hold: f.hold, held });
  }

  private fightTap(): void {
    const f = this.fight!;
    const t = this.fightTiming!;
    if (f.stage === 'dip') {
      f.hits += 1;
      this.emit({ type: 'dipHit', index: f.index });
      this.advanceDip();
    } else if (f.stage === 'gap') {
      // A tap just after the last one is a double tap, not a fumble.
      if (f.stageMs < t.graceMs) return;
      this.emit({ type: 'dipMiss', index: f.index, fumble: true });
      this.advanceDip();
    } else {
      f.holding = true;
    }
  }

  private updateFight(dt: number): void {
    const f = this.fight!;
    const t = this.fightTiming!;
    f.stageMs += dt;
    if (f.stage === 'gap' && f.stageMs >= f.gapMs) {
      f.stage = 'dip';
      f.stageMs = 0;
      this.emit({ type: 'dip', index: f.index, windowMs: t.dipMs });
    } else if (f.stage === 'dip' && f.stageMs >= t.dipMs) {
      this.emit({ type: 'dipMiss', index: f.index, fumble: false });
      this.advanceDip();
    } else if (f.stage === 'hold') {
      if (f.holding) f.heldMs += dt;
      if (f.heldMs >= t.holdMs) this.endFight(true);
      else if (f.stageMs >= t.holdMaxMs) this.endFight(false);
    }
  }

  private enter(phase: FishingPhase, duration = 0): void {
    this.phase = phase;
    this.elapsed = 0;
    this.duration = duration;
  }

  /** Player tapped. Returns what the tap did. */
  tap(): SessionEvent['type'] | 'none' {
    if (this.phase === 'fight' && this.fight) {
      this.fightTap();
      return 'none';
    }
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
    if (this.phase === 'fight' && this.fight) {
      this.updateFight(dtMs);
      return;
    }
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
