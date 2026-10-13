// Small shared state between scenes that is about presentation, not gameplay.
// The world scene writes anchors each frame; overlay scenes read them.

export const worldAnchors = {
  /** Where the fishing line leaves the rod. */
  rodTip: { x: 0, y: 0 },
  /** Current gentle bob of the boat, in pixels. */
  bob: 0,
};

export const uiState = {
  /** Scene key of the open panel, or null. Fishing ignores taps while one is open. */
  openPanel: null as string | null,
  /** True while a modal popup (like the catch card) is showing. */
  modal: false,
  /** True while the boat sails to another water. */
  voyaging: false,
};
