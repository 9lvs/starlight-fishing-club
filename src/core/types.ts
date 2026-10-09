// Shared data shapes used by events and features.

export interface CatchResult {
  fishId: string;
  rarityId: string;
  /** Size in cm. */
  size: number;
  /** Value if sold now, already multiplied by sell modifiers. */
  value: number;
  currency: string;
  waterId: string;
  phase: string;
  weather: string;
  pityTriggered: boolean;
  at: number;
  /** Listeners may annotate a catch, e.g. the journal sets flags.new on a first catch. */
  flags: Record<string, boolean>;
}

export interface OfflineReport {
  featureId: string;
  title: string;
  lines: string[];
  earned?: Record<string, number>;
  catches?: Record<string, number>;
}

export interface ToastRequest {
  text: string;
  icon?: string;
  color?: string;
  /** Lower numbers show first when several arrive at once. */
  priority?: number;
}
