// UI components stay independent of the core. The core sets these hooks at
// boot (for click sounds and reduced motion) and components call them.

export const uiSignals = {
  click: (): void => {},
  reducedMotion: (): boolean => false,
};
