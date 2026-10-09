// Loads the real content packs exactly the way the game does (Vite glob import),
// so tests see the same files and the same keys. Packs that require a feature
// (pack.json "requires") are left out, as they would be with no features registered.
import { parseContent } from '../../src/core/content/parseContent';

const modules = import.meta.glob('../../src/content/*/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

const featurePacks = new Set(
  Object.entries(modules)
    .filter(([path, data]) => path.endsWith('/pack.json') && ((data as { requires?: string[] }).requires ?? []).length > 0)
    .map(([path]) => path.split('/').slice(-2)[0]),
);

export function readContentFiles(): Record<string, unknown> {
  return Object.fromEntries(Object.entries(modules).filter(([path]) => !featurePacks.has(path.split('/').slice(-2)[0])));
}

export function loadBaseContent() {
  return parseContent(readContentFiles());
}
