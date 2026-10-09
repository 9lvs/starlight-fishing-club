// Wall clock with a debug offset, so time-of-day and offline catch-up can be
// tested by shifting time instead of waiting.

export class Clock {
  private offsetMs = 0;

  constructor(private readonly source: () => number = () => Date.now()) {}

  now(): number {
    return this.source() + this.offsetMs;
  }

  /** Debug only: shift the clock forward or back. */
  shift(ms: number): void {
    this.offsetMs += ms;
  }

  get offset(): number {
    return this.offsetMs;
  }
}
