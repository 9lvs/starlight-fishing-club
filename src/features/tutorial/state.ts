// Tutorial save slice. step is the next guide step; -1 means "not decided yet"
// (a save from before the tutorial existed skips the guide but still gets tips).
import type { SaveSliceDef } from '../../core/feature';

export interface TutorialSlice {
  step: number;
  /** One-time tips already shown. */
  seen: string[];
  /** Tips waiting for their moment. */
  queue: string[];
  handCatches: number;
}

export const tutorialSlice: SaveSliceDef<TutorialSlice> = {
  key: 'tutorial',
  version: 1,
  defaults: () => ({ step: -1, seen: [], queue: [], handCatches: 0 }),
};
