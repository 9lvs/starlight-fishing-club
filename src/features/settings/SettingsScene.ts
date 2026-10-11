// Settings: sound, volume, reduced motion, save export/import/reset, credits.
import type { Rect } from '../../core/layout';
import { PanelScene } from '../../scenes/PanelScene';
import { Button } from '../../ui/Button';
import { LINKS } from '../../config/links';
import type Phaser from 'phaser';
import { openDomDialog } from '../../ui/domDialog';
import { ScrollArea } from '../../ui/ScrollArea';
import { gameUrl, shareText } from '../../ui/share';
import { addText } from '../../ui/text';
import { applySettings, VOLUME_STEP, type MotionPref, type SettingsSlice } from './state';

const ROW = 28;
const MOTION_NEXT: Record<MotionPref, MotionPref> = { system: 'on', on: 'off', off: 'system' };
const MOTION_LABEL: Record<MotionPref, string> = { system: 'System', on: 'On', off: 'Off' };

export class SettingsScene extends PanelScene {
  readonly title = 'Settings';
  override readonly icon = 'icon_settings';
  private resetArmed = false;

  constructor() {
    super('Settings');
  }

  private get s(): SettingsSlice {
    return this.ctx.save.slice<SettingsSlice>('settings');
  }

  private changed(): void {
    applySettings(this.ctx, this.s);
    this.scene.restart();
  }

  protected build(area: Rect): void {
    // Everything is laid out in panel coordinates, then moved into a scroll area
    // so short screens (phones on their side) can still reach the bottom rows.
    const before = new Set(this.children.list);
    const end = this.buildRows(area);
    const scroll = new ScrollArea(this, area);
    for (const obj of [...this.children.list]) {
      if (before.has(obj) || obj === scroll.content) continue;
      const o = obj as Phaser.GameObjects.GameObject & { x: number; y: number };
      o.x -= area.x;
      o.y -= area.y;
      scroll.add(obj);
    }
    scroll.setContentHeight(end - area.y + 4);
  }

  /** Builds every row; returns the y below the last one. */
  private buildRows(area: Rect): number {
    const s = this.s;
    const x = area.x;
    const right = area.x + area.w;
    let y = area.y + 2;
    const label = (t: string) => addText(this, x, y + 6, t, { color: 'mist', shadow: false });

    label('Sound');
    new Button(this, {
      x: right - 70,
      y,
      w: 70,
      label: s.muted ? 'Off' : 'On',
      icon: s.muted ? 'icon_mute' : 'icon_sound',
      onClick: () => {
        s.muted = !s.muted;
        this.changed();
      },
    });
    y += ROW;

    label('Volume');
    new Button(this, { x: right - 70, y, w: 24, label: '-', onClick: () => this.setVolume(s.volume - VOLUME_STEP) });
    addText(this, right - 35, y + 6, `${Math.round(s.volume * 100)}%`, { originX: 0.5, color: 'gold', shadow: false });
    new Button(this, { x: right - 24, y, w: 24, label: '+', onClick: () => this.setVolume(s.volume + VOLUME_STEP) });
    y += ROW;

    label('Reduced motion');
    new Button(this, {
      x: right - 70,
      y,
      w: 70,
      label: MOTION_LABEL[s.reducedMotion],
      icon: 'icon_motion',
      onClick: () => {
        s.reducedMotion = MOTION_NEXT[s.reducedMotion];
        this.changed();
      },
    });
    y += ROW + 6;

    addText(this, x, y, 'Your save', { color: 'gold' });
    y += 14;
    const half = Math.floor((area.w - 4) / 2);
    new Button(this, { x, y, w: half, label: 'Export', onClick: () => this.exportSave() });
    new Button(this, { x: x + half + 4, y, w: half, label: 'Import', onClick: () => this.importSave() });
    y += ROW;
    const reset = new Button(this, {
      x,
      y,
      w: area.w,
      label: 'Reset save',
      variant: 'secondary',
      onClick: () => {
        if (!this.resetArmed) {
          this.resetArmed = true;
          reset.setLabel('Tap again to erase everything');
          reset.setHighlighted(true);
          this.time.delayedCall(3500, () => {
            this.resetArmed = false;
            if (reset.active) reset.setLabel('Reset save').setHighlighted(false);
          });
          return;
        }
        this.ctx.save.reset();
        location.reload();
      },
    });
    y += ROW + 8;

    addText(this, x, y, 'Friends', { color: 'gold' });
    y += 14;
    const friendW = LINKS.feedbackUrl ? half : area.w;
    new Button(this, {
      x,
      y,
      w: friendW,
      label: 'Tell a friend',
      onClick: () => {
        const text = `A calm little pixel fishing game you can play in your browser: Starlight Fishing Club 🎣\n${gameUrl()}`;
        void shareText('Starlight Fishing Club', text).then((res) => {
          if (res === 'copied') this.ctx.ui.toast('Link copied. Thank you!');
        });
      },
    });
    if (LINKS.feedbackUrl) {
      new Button(this, { x: x + half + 4, y, w: half, label: 'Feedback', onClick: () => window.open(LINKS.feedbackUrl, '_blank', 'noopener') });
    }
    y += ROW + 8;

    addText(this, x, y, 'Credits', { color: 'gold' });
    y += 14;
    const credits = addText(
      this,
      x,
      y,
      'Starlight Fishing Club\nMade with Phaser.\nFont: Pixelify Sans by the Pixelify Sans Project Authors, SIL Open Font License 1.1.',
      { color: 'sky', shadow: false, maxWidth: area.w },
    );
    return y + credits.textHeight;
  }

  private setVolume(v: number): void {
    this.s.volume = Math.round(Math.max(0, Math.min(1, v)) * 10) / 10;
    this.changed();
  }

  private exportSave(): void {
    this.ctx.save.save();
    openDomDialog({
      title: 'Export save',
      text: 'Copy this code somewhere safe. Paste it into Import to restore.',
      value: this.ctx.save.exportString(),
      readOnly: true,
    });
  }

  private importSave(): void {
    openDomDialog({
      title: 'Import save',
      text: 'Paste a save code. Your current save is only replaced if the code is valid.',
      confirmLabel: 'Import',
      onConfirm: (value, setError) => {
        const res = this.ctx.save.importString(value);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        location.reload();
      },
    });
  }
}
