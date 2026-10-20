// Sign in and cloud saves (Supabase). The URL and the anon key are public by
// design: they ship inside the game, and row level security in the database
// (supabase/migrations) keeps each player's save readable only by them.
// Leave `url` empty to turn the whole feature off.

export const CLOUD = {
  url: 'https://kkfxlklaqcoixykicvwo.supabase.co',
  anonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrZnhsa2xhcWNvaXh5a2ljdndvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MTQxODAsImV4cCI6MjEwODA5MDE4MH0.gxc4YBQHjVLj30JD7tEbQByYXiBAe_Pq6XJhvB71wk0',
  table: 'saves',
  /** Upload the save this often while playing, when it has changed. */
  syncEveryMs: 2 * 60_000,
  /** Never upload more often than this (also on tab hide). */
  minUploadGapMs: 20_000,
  /** The database refuses saves bigger than this; the game checks first. */
  maxSaveBytes: 256_000,
  /** Where the privacy note lives (relative to the game). */
  privacyPath: 'privacy.html',
};

export const cloudEnabled = (): boolean => CLOUD.url.length > 0 && CLOUD.anonKey.length > 0;
