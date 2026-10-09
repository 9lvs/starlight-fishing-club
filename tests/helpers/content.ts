// Loads the real content packs exactly the way the game does (Vite glob import),
// so tests see the same files and the same keys.
import { parseContent } from '../../src/core/content/parseContent';

const modules = import.meta.glob('../../src/content/*/*.json', { eager: true, import: 'default' });

export function readContentFiles(): Record<string, unknown> {
  return { ...(modules as Record<string, unknown>) };
}

export function loadBaseContent() {
  return parseContent(readContentFiles());
}
