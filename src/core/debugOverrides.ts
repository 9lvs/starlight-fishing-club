// Debug-only switches read by gameplay code. Always inert unless a debug
// command sets them.

export const debugOverrides = {
  /** Force the next hand catches to this rarity id. */
  forceRarity: null as string | null,
};
