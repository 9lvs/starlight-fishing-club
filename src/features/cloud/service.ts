// Sign in (Google, or a link by email) and the cloud copy of the save. The
// save on this device always comes first: the cloud is a copy that follows
// it, and when both changed the player chooses. The Supabase library loads
// only when the feature starts, so it never slows the first paint.
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { CLOUD } from '../../config/cloud';
import { GAME_VERSION } from '../../config/links';
import { SAVE } from '../../config/tuning';
import type { GameContext } from '../../core/context';
import { decide, summarize, type SaveSummary, type SyncMarker } from './sync';

export type CloudState = 'starting' | 'signedOut' | 'signedIn' | 'offline' | 'framed';

export interface Conflict {
  local: SaveSummary;
  cloud: SaveSummary;
}

const MARKER_KEY = 'starlight-fishing-club/cloud-sync';

export class CloudService {
  state: CloudState = 'starting';
  email: string | null = null;
  /** When this device last uploaded (wall clock); keeps automatic uploads spaced out. */
  lastUpload = 0;
  /** When this device last matched the cloud, by upload or a check, for the Account panel. */
  lastSynced = 0;
  /** Waiting on the player: keep this device's save or the cloud's. */
  conflict: Conflict | null = null;
  busy = false;
  private client: SupabaseClient | null = null;
  private userId: string | null = null;
  private sinceSync = 0;

  constructor(private readonly ctx: GameContext) {}

  async start(): Promise<void> {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      this.client = createClient(CLOUD.url, CLOUD.anonKey, {
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
    } catch (err) {
      console.warn('[cloud] could not load', err);
      this.set('offline');
      return;
    }
    this.client.auth.onAuthStateChange((event, session) => {
      // Run outside the auth callback: Supabase warns against awaiting inside it.
      setTimeout(() => void this.onSession(event, session), 0);
    });
    const { data } = await this.client.auth.getSession();
    await this.onSession('INITIAL_SESSION', data.session);
    this.cleanUrl();
  }

  /** Called every tick: upload now and then while playing. */
  tick(dtMs: number): void {
    if (this.state !== 'signedIn') return;
    this.sinceSync += dtMs;
    if (this.sinceSync >= CLOUD.syncEveryMs) void this.sync();
  }

  async signInWithGoogle(): Promise<string | null> {
    if (!this.client) return 'Sign in is not available right now.';
    const { error } = await this.client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: here() } });
    return error ? error.message : null;
  }

  async signInWithEmail(email: string): Promise<string | null> {
    if (!this.client) return 'Sign in is not available right now.';
    const { error } = await this.client.auth.signInWithOtp({ email, options: { emailRedirectTo: here() } });
    return error ? error.message : null;
  }

  async signOut(): Promise<void> {
    // One last copy, so nothing played on this device is lost.
    await this.sync();
    await this.client?.auth.signOut();
  }

  /**
   * Compare with the cloud and do what the rules say: upload, download (the
   * game reloads), or ask. Automatic syncs stay quiet; Save now (`manual`)
   * skips the spacing between uploads and always says how it went.
   */
  async sync(manual = false): Promise<void> {
    const c = this.client;
    const uid = this.userId;
    if (!c || !uid || this.busy || this.conflict) return;
    this.busy = true;
    this.sinceSync = 0;
    this.changed();
    let said = '';
    try {
      this.ctx.save.save();
      const local = summarize(this.ctx.save.snapshot());
      const { data, error } = await c.from(CLOUD.table).select('progress').eq('user_id', uid).maybeSingle();
      if (error) throw error;
      const cloud = data ? readSummary(data.progress) : null;
      const action = decide(local, cloud, readMarker(), uid);
      if (action === 'upload') {
        const sent = await this.upload(local, { force: manual });
        said = sent ? 'Saved to the cloud.' : 'Saved to the cloud a moment ago.';
      } else if (action === 'download') await this.download();
      else if (action === 'ask' && cloud) {
        this.conflict = { local, cloud };
        this.ctx.ui.openPanel('Account');
      } else if (action === 'none') {
        writeMarker({ userId: uid, hash: local.hash });
        this.lastSynced = Date.now();
        said = 'Your cloud save is up to date.';
      }
    } catch (err) {
      console.warn('[cloud] sync failed', err);
      said = 'Could not reach the cloud. Your club is still saved on this device.';
    } finally {
      this.busy = false;
      this.changed();
    }
    if (manual && said) this.ctx.ui.toast(said, { icon: 'icon_check', color: said.startsWith('Could') ? 'coral' : 'sage' });
  }

  /** The player chose in a conflict. */
  async resolve(keep: 'device' | 'cloud'): Promise<void> {
    const conflict = this.conflict;
    this.conflict = null;
    if (!conflict) return;
    this.busy = true;
    try {
      if (keep === 'cloud') await this.download();
      else await this.upload(summarize(this.ctx.save.snapshot()), { force: true, backup: true });
    } finally {
      this.busy = false;
      this.changed();
    }
  }

  async deleteCloudSave(): Promise<boolean> {
    if (!this.client || !this.userId) return false;
    const { error } = await this.client.from(CLOUD.table).delete().eq('user_id', this.userId);
    if (!error) {
      localStorage.removeItem(MARKER_KEY);
      this.lastUpload = 0;
      this.lastSynced = 0;
    }
    this.changed();
    return !error;
  }

  /** Removes the sign in and the cloud save for good. The save on this device stays. */
  async deleteAccount(): Promise<boolean> {
    if (!this.client || !this.userId) return false;
    const { error } = await this.client.rpc('delete_my_account');
    if (error) return false;
    localStorage.removeItem(MARKER_KEY);
    await this.client.auth.signOut();
    return true;
  }

  /** Returns false when skipped (an upload happened moments ago). */
  private async upload(local: SaveSummary, o: { force?: boolean; backup?: boolean } = {}): Promise<boolean> {
    const c = this.client;
    const uid = this.userId;
    if (!c || !uid) return false;
    if (!o.force && Date.now() - this.lastUpload < CLOUD.minUploadGapMs) return false;
    const data = this.ctx.save.exportString();
    if (data.length > CLOUD.maxSaveBytes) throw new Error('save too large to upload');
    // Keep the cloud copy this replaces on the device, just in case.
    if (o.backup) {
      const { data: old } = await c.from(CLOUD.table).select('data').eq('user_id', uid).maybeSingle();
      if (old?.data) safeSet(`${SAVE.backupKeyPrefix}cloud`, old.data);
    }
    const { error } = await c.from(CLOUD.table).upsert({ user_id: uid, data, progress: local, game_version: GAME_VERSION, saved_at: local.savedAt });
    if (error) throw error;
    writeMarker({ userId: uid, hash: local.hash });
    this.lastUpload = Date.now();
    this.lastSynced = this.lastUpload;
    return true;
  }

  private async download(): Promise<void> {
    const c = this.client;
    const uid = this.userId;
    if (!c || !uid) return;
    const { data, error } = await c.from(CLOUD.table).select('data').eq('user_id', uid).maybeSingle();
    if (error || !data?.data) return;
    const check = this.ctx.save.validateImport(data.data);
    if (!check.ok) {
      console.warn('[cloud] cloud save could not be read', check.error);
      return;
    }
    // Keep this device's save before it is replaced.
    safeSet(`${SAVE.backupKeyPrefix}device`, this.ctx.save.exportString());
    const res = this.ctx.save.importString(data.data);
    if (!res.ok) return;
    writeMarker({ userId: uid, hash: summarize(check.root).hash });
    location.reload();
  }

  private async onSession(event: string, session: Session | null): Promise<void> {
    const uid = session?.user.id ?? null;
    if (!uid) {
      this.userId = null;
      this.email = null;
      this.conflict = null;
      this.set('signedOut');
      return;
    }
    const wasSignedIn = this.userId === uid;
    this.userId = uid;
    this.email = session?.user.email ?? null;
    this.set('signedIn');
    if (!wasSignedIn) {
      if (event === 'SIGNED_IN') this.ctx.ui.toast('Signed in. Your club is saved to the cloud.', { icon: 'icon_check', color: 'sage' });
      await this.sync();
    }
  }

  private set(s: CloudState): void {
    this.state = s;
    this.changed();
  }

  private changed(): void {
    this.ctx.bus.emit('cloudChanged', { state: this.state });
  }

  /** Sign-in links come back with a code in the address; tidy it away. */
  private cleanUrl(): void {
    const url = new URL(location.href);
    if (!url.searchParams.has('code') && !url.hash.includes('access_token')) return;
    url.searchParams.delete('code');
    history.replaceState(null, '', url.pathname + url.search);
  }
}

/** The page the player is on, so sign-in comes back to the game wherever it is hosted. */
function here(): string {
  return location.origin + location.pathname;
}

/** The summary stored next to a cloud save (what this game uploaded). */
function readSummary(v: unknown): SaveSummary | null {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  return o && typeof o.hash === 'string' ? (o as unknown as SaveSummary) : null;
}

function readMarker(): SyncMarker | null {
  try {
    const m = JSON.parse(localStorage.getItem(MARKER_KEY) ?? 'null') as SyncMarker | null;
    return m && typeof m.userId === 'string' && typeof m.hash === 'string' ? m : null;
  } catch {
    return null;
  }
}

function writeMarker(m: SyncMarker): void {
  safeSet(MARKER_KEY, JSON.stringify(m));
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage full or blocked: syncing still works, only the local note is lost.
  }
}

let current: CloudService | null = null;
export function setCloud(s: CloudService): void {
  current = s;
}
export function getCloud(): CloudService {
  if (!current) throw new Error('Cloud feature not initialised');
  return current;
}
