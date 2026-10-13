// The voyage between waters: after the boat sails off the right edge, a small
// chart shows the trip from the old water to the new one, then the new place
// is revealed and its name settles in over the sky. Tapping skips ahead.
// WorldScene drives the boat and repaints the scenery at `onCovered`.
import Phaser from 'phaser';
import { getLayout } from '../core/layout';
import { VOYAGE } from '../config/tuning';
import { color, MOTION } from '../design/tokens';
import { addText } from '../ui/text';

export interface VoyageData {
  fromName: string;
  fromIcon: string;
  toName: string;
  toIcon: string;
  toBlurb: string;
  /** Moving the club (a fresh start with a bonus) rather than a visit. */
  club: boolean;
  bonusText?: string;
  /** A short hop between waters you already have: no chart, a quick fade. */
  quick?: boolean;
  onCovered: () => void;
  onReveal: () => void;
  onDone: () => void;
}

export class VoyageScene extends Phaser.Scene {
  private d!: VoyageData;
  private stage: 'cover' | 'chart' | 'reveal' | 'title' = 'cover';
  private chart!: Phaser.GameObjects.Container;
  private backdrop!: Phaser.GameObjects.TileSprite;

  constructor() {
    super('Voyage');
  }

  private get t(): typeof VOYAGE.quick {
    return this.d.quick ? VOYAGE.quick : VOYAGE;
  }

  create(d: VoyageData): void {
    this.d = d;
    this.stage = 'cover';
    const L = getLayout();
    const { width: W, height: H } = L;
    const dither = this.textures.exists('dither_50') ? 'dither_50' : '__WHITE';
    this.backdrop = this.add.tileSprite(0, 0, W, H, dither).setOrigin(0, 0).setTint(color('ink')).setAlpha(0);
    const solid = this.add.rectangle(0, 0, W, H, color('ink'), 0).setOrigin(0, 0);
    this.input.on('pointerup', () => this.skip());

    this.chart = this.buildChart(Math.round(W / 2), Math.round(H * 0.42));
    this.chart.setAlpha(0);

    const t = this.t;
    this.tweens.add({ targets: this.backdrop, alpha: 1, duration: t.coverMs, ease: MOTION.ease });
    this.tweens.add({
      targets: solid,
      alpha: 0.75,
      duration: t.coverMs,
      ease: MOTION.ease,
      onComplete: () => {
        d.onCovered();
        if (d.quick) {
          this.stage = 'reveal';
          this.events.emit('reveal');
          return;
        }
        this.stage = 'chart';
        this.tweens.add({ targets: this.chart, alpha: 1, duration: 250 });
        this.sail();
      },
    });
    this.events.once('reveal', () => {
      this.tweens.add({ targets: [this.backdrop, solid, this.chart], alpha: 0, duration: t.revealMs, ease: MOTION.ease });
      d.onReveal();
      // Fishing resumes once the boat is home; the name keeps fading on its own.
      this.time.delayedCall(t.sailInMs, () => d.onDone());
      this.time.delayedCall(t.revealMs * 0.6, () => this.title());
    });
  }

  /** The chart: old water on the left, new on the right, a dotted route, and the boat. */
  private buildChart(cx: number, cy: number): Phaser.GameObjects.Container {
    const c = this.add.container(cx, cy);
    const w = 170;
    const h = 80;
    const g = this.add.graphics();
    g.fillStyle(color('bark'));
    g.fillRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2);
    g.fillStyle(color('sand'));
    g.fillRect(-w / 2, -h / 2, w, h);
    g.fillStyle(color('mist'), 0.35);
    g.fillRect(-w / 2 + 1, -h / 2 + 1, w - 2, 1);
    c.add(g);
    const head = this.d.club ? 'The club is moving' : 'Setting sail';
    c.add(addText(this, 0, -h / 2 + 4, head, { originX: 0.5, color: 'bark', shadow: false }));
    const y = -2;
    const x0 = -w / 2 + 30;
    const x1 = w / 2 - 30;
    for (const [x, icon, name] of [
      [x0, this.d.fromIcon, this.d.fromName],
      [x1, this.d.toIcon, this.d.toName],
    ] as const) {
      if (this.textures.exists(icon)) c.add(this.add.image(x, y, icon));
      c.add(addText(this, x, y + 15, name, { originX: 0.5, color: 'bark', shadow: false, maxWidth: 54, align: 'center' }));
    }
    const dots = this.add.graphics();
    c.add(dots);
    const boat = this.add.image(x0, y - 7, this.textures.exists('icon_boat') ? 'icon_boat' : '__WHITE');
    c.add(boat);
    c.setData({ dots, boat, x0: x0 + 19, x1: x1 - 19, y });
    return c;
  }

  private sail(): void {
    const { dots, boat, x0, x1, y } = this.chart.data.values as {
      dots: Phaser.GameObjects.Graphics;
      boat: Phaser.GameObjects.Image;
      x0: number;
      x1: number;
      y: number;
    };
    const t = { k: 0 };
    this.tweens.add({
      targets: t,
      k: 1,
      duration: VOYAGE.chartMs,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const x = x0 + (x1 - x0) * t.k;
        // A gentle arc, like a route drawn on a map.
        const arc = (k: number) => Math.round(y - Math.sin(k * Math.PI) * 8);
        dots.clear();
        dots.fillStyle(color('coral'));
        for (let dx = x0; dx <= x; dx += 4) dots.fillRect(dx, arc((dx - x0) / (x1 - x0)), 2, 1);
        boat.setPosition(Math.round(x), arc(t.k) - 6);
      },
      onComplete: () => this.reveal(),
    });
  }

  private reveal(): void {
    if (this.stage !== 'chart') return;
    this.stage = 'reveal';
    this.time.delayedCall(VOYAGE.holdMs, () => this.events.emit('reveal'));
  }

  /** The new water's name over the sky, then the scene ends. */
  private title(): void {
    this.stage = 'title';
    const L = getLayout();
    const cx = Math.round(L.width / 2);
    const y = Math.round(L.horizonY * 0.38);
    const parts: Phaser.GameObjects.GameObject[] = [];
    const name = addText(this, cx, y, this.d.toName, { originX: 0.5, color: 'mist', outline: 'ink', scale: 2 });
    parts.push(name);
    const blurb = addText(this, cx, y + name.textHeight + 4, this.d.quick ? '' : this.d.toBlurb, { originX: 0.5, align: 'center', color: 'sand', outline: 'ink', maxWidth: Math.min(L.width - 16, 170) });
    parts.push(blurb);
    if (this.d.bonusText) parts.push(addText(this, cx, y + name.textHeight + blurb.textHeight + 8, this.d.bonusText, { originX: 0.5, color: 'gold', outline: 'ink' }));
    for (const p of parts) (p as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0);
    this.tweens.add({ targets: parts, alpha: 1, duration: 500, ease: MOTION.ease });
    this.tweens.add({
      targets: parts,
      alpha: 0,
      delay: this.t.titleMs,
      duration: 800,
      ease: MOTION.ease,
      onComplete: () => this.scene.stop(),
    });
  }

  private skip(): void {
    if (this.stage === 'chart') {
      this.tweens.killTweensOf(this.chart);
      this.tweens.getTweens().forEach((t) => t.complete());
      this.chart.setAlpha(1);
    }
  }
}
