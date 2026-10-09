// THE feature registry. This is the only file that lists features. Removing a
// line here removes that feature cleanly; the core never imports a feature.
import type { GameFeature } from '../core/feature';
import { fishingFeature } from './fishing';
import { journalFeature } from './journal';

export const FEATURES: GameFeature[] = [fishingFeature, journalFeature];
