import { defineConfig } from 'vitest/config';

// Relative base so the static build works from any sub-path (GitHub Pages, itch.io).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
  server: {
    host: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Tests are pure logic with no shared globals, so one worker is enough and
    // avoids paying worker start-up cost per file.
    pool: 'threads',
    isolate: false,
    fileParallelism: false,
  },
});
