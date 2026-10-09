// Vite glob import: every JSON file in src/content/<pack>/ is picked up
// automatically. Dropping in a new file adds content with no code changes.
import type { ZodType } from 'zod';
import { parseContent, type ParseResult } from './parseContent';

const modules = import.meta.glob('../../content/*/*.json', { eager: true, import: 'default' });

export function loadContent(extraSchemas: Record<string, ZodType> = {}, featureIds?: readonly string[]): ParseResult {
  return parseContent(modules as Record<string, unknown>, extraSchemas, featureIds);
}
