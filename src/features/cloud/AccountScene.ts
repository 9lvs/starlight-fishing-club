// Account: sign in to keep a copy of the club in the cloud and play on any
// device. Optional: the game always saves on this device too.
import type { Rect } from '../../core/layout';
import { CLOUD } from '../../config/cloud';
import { PanelScene } from '../../scenes/PanelScene';
import { Button } from '../../ui/Button';
import { openDomDialog } from '../../ui/domDialog';
import { formatNumber } from '../../ui/format';
import { addText } from '../../ui/text';
import { getCloud } from './service';
import type { SaveSummary } from './sync';

const ROW = 28;

export class AccountScene extends PanelScene {
  readonly title = 'Account';
  override readonly icon = 'icon_crew';
  private armed: string | null = null;

  constructor() {
    super('Account');
  }

  protected build(area: Rect): void {
    this.listen('cloudChanged', () => this.refresh());
    const cloud = getCloud();
    if (cloud.conflict) return this.buildConflict(area, cloud.conflict.local, cloud.conflict.cloud);
    if (cloud.state === 'signedIn') return this.buildSignedIn(area);
    if (cloud.state === 'signedOut') return this.buildSignedOut(area);
    const words =
      cloud.state === 'framed'
        ? 'Sign in works on the game\'s own site. Here your club is saved on this device, and Export in Settings keeps a copy.'
        : cloud.state === 'offline'
          ? 'Sign in is not available right now. Your club is still saved on this device.'
          : 'Checking...';
    addText(this, area.x, area.y, words, { color: 'sky', maxWidth: area.w, shadow: false });
  }

  private buildSignedOut(area: Rect): void {
    const { x, w } = area;
    let y = area.y;
    const intro = addText(this, x, y, 'Sign in to keep a copy of your club in the cloud, and pick it up on any device.', { color: 'mist', maxWidth: w, shadow: false });
    y += intro.textHeight + 6;
    const note = addText(this, x, y, 'Optional. Your club is always saved on this device too.', { color: 'slate', maxWidth: w, shadow: false });
    y += note.textHeight + 10;
    new Button(this, {
      x,
      y,
      w,
      label: 'Sign in with Google',
      variant: 'primary',
      onClick: () => void getCloud().signInWithGoogle().then((err) => err && this.ctx.ui.toast(err)),
    });
    y += ROW;
    new Button(this, { x, y, w, label: 'Email me a sign-in link', onClick: () => this.emailDialog() });
    y += ROW + 8;
    this.privacyButton(area, y);
  }

  private buildSignedIn(area: Rect): void {
    const cloud = getCloud();
    const { x, w } = area;
    let y = area.y;
    addText(this, x, y, 'Signed in as', { color: 'slate', shadow: false });
    y += 12;
    addText(this, x, y, cloud.email ?? 'your account', { color: 'gold', maxWidth: w, shadow: false });
    y += 16;
    const when = cloud.busy ? 'Saving...' : cloud.lastSynced > 0 ? `Cloud save up to date ${ago(cloud.lastSynced)}.` : 'Your club is kept in the cloud.';
    addText(this, x, y, when, { color: 'sky', maxWidth: w, shadow: false });
    y += 18;
    const half = Math.floor((w - 4) / 2);
    new Button(this, { x, y, w: half, label: 'Save now', variant: 'primary', onClick: () => void getCloud().sync(true) });
    new Button(this, { x: x + half + 4, y, w: half, label: 'Sign out', onClick: () => void getCloud().signOut() });
    y += ROW + 10;

    // Asked twice, like Reset save: these cannot be undone.
    addText(this, x, y, 'Your data', { color: 'gold' });
    y += 14;
    this.armedButton(area, y, 'delete-save', 'Delete cloud save', 'Tap again to delete it', async () => {
      const ok = await getCloud().deleteCloudSave();
      this.ctx.ui.toast(ok ? 'Cloud save deleted. Your club is still on this device.' : 'Could not delete it. Try again later.');
    });
    y += ROW;
    this.armedButton(area, y, 'delete-account', 'Delete my account', 'Tap again to delete it', async () => {
      const ok = await getCloud().deleteAccount();
      this.ctx.ui.toast(ok ? 'Account deleted. Your club is still on this device.' : 'Could not delete it. Try again later.');
    });
    y += ROW + 8;
    this.privacyButton(area, y);
  }

  private buildConflict(area: Rect, local: SaveSummary, cloud: SaveSummary): void {
    const { x, w } = area;
    let y = area.y;
    const intro = addText(this, x, y, 'This device and the cloud have different clubs. Which one would you like to keep?', { color: 'mist', maxWidth: w, shadow: false });
    y += intro.textHeight + 8;
    const card = (title: string, s: SaveSummary, keep: 'device' | 'cloud') => {
      addText(this, x, y, title, { color: 'gold', shadow: false });
      y += 12;
      const water = this.ctx.registries.waters.tryGet(s.waterId)?.name ?? 'Willow Pond';
      const t = addText(this, x, y, `${water}\n${s.species} kinds of fish, ${formatNumber(s.catches)} caught\n${formatNumber(s.coins)} coins`, { color: 'sky', shadow: false, maxWidth: w });
      y += t.textHeight + 4;
      new Button(this, { x, y, w, label: keep === 'device' ? 'Keep this device' : 'Use the cloud save', variant: 'primary', onClick: () => void getCloud().resolve(keep) });
      y += ROW + 8;
    };
    card('On this device', local, 'device');
    card('In the cloud', cloud, 'cloud');
    addText(this, x, y, 'The other one is kept as a backup on this device.', { color: 'slate', maxWidth: w, shadow: false });
  }

  private emailDialog(): void {
    openDomDialog({
      title: 'Sign in with email',
      text: 'We will email you a link. Open it on this device to sign in. No password needed.',
      input: 'email',
      placeholder: 'you@example.com',
      confirmLabel: 'Send link',
      onConfirm: (value, setError) => {
        const email = value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setError('That does not look like an email address.');
          return;
        }
        setError('Sending...');
        void getCloud()
          .signInWithEmail(email)
          .then((err) => setError(err ? err : 'Sent! Check your email (and spam folder) for the link.'));
      },
    });
  }

  private armedButton(area: Rect, y: number, id: string, label: string, confirm: string, run: () => Promise<void>): void {
    const b = new Button(this, {
      x: area.x,
      y,
      w: area.w,
      label,
      variant: 'secondary',
      onClick: () => {
        if (this.armed !== id) {
          this.armed = id;
          b.setLabel(confirm).setHighlighted(true);
          this.time.delayedCall(3500, () => {
            if (this.armed === id) this.armed = null;
            if (b.active) b.setLabel(label).setHighlighted(false);
          });
          return;
        }
        this.armed = null;
        void run();
      },
    });
  }

  private privacyButton(area: Rect, y: number): void {
    new Button(this, { x: area.x, y, w: area.w, label: 'Privacy', variant: 'ghost', onClick: () => window.open(CLOUD.privacyPath, '_blank', 'noopener') });
  }
}

function ago(at: number): string {
  const min = Math.floor((Date.now() - at) / 60_000);
  if (min < 1) return 'just now';
  return min === 1 ? '1 minute ago' : `${min} minutes ago`;
}
