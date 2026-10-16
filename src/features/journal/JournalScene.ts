// Journal: a grid of fish that fills in as you catch them. Uncaught fish are
// silhouettes with a gentle hint about where and when to look.
import type { Rect } from '../../core/layout';
import type { FishDef } from '../../core/content/schemas';
import { TIME } from '../../config/time';
import { PanelScene } from '../../scenes/PanelScene';
import { Button } from '../../ui/Button';
import { drawPanelBox } from '../../ui/pixelDraw';
import { drawRarityShape } from '../../ui/rarityShapes';
import { ProgressBar } from '../../ui/ProgressBar';
import { RarityBanner } from '../../ui/RarityBanner';
import { ScrollArea } from '../../ui/ScrollArea';
import { addText } from '../../ui/text';
import { color } from '../../design/tokens';
import { completion, type JournalSlice } from './state';

const CELL = 30;

interface JournalData {
  fishId?: string;
}

export class JournalScene extends PanelScene<JournalData> {
  readonly title = 'Journal';
  override readonly icon = 'icon_journal';

  constructor() {
    super('Journal');
  }

  private get slice(): JournalSlice {
    return this.ctx.save.slice<JournalSlice>('journal');
  }

  private sortedFish(): FishDef[] {
    const r = this.ctx.registries;
    const waterOrder = (f: FishDef) => Math.min(...f.waters.map((w) => r.waters.tryGet(w)?.order ?? 99));
    const tier = (f: FishDef) => r.rarities.tryGet(f.rarity)?.tier ?? 0;
    return [...r.fish.list()].sort((a, b) => waterOrder(a) - waterOrder(b) || tier(a) - tier(b) || a.name.localeCompare(b.name));
  }

  protected build(area: Rect, data?: JournalData): void {
    if (data?.fishId) this.buildDetail(area, data.fishId);
    else this.buildGrid(area);
  }

  private buildGrid(area: Rect): void {
    const fish = this.sortedFish();
    const pct = completion(this.slice, fish.map((f) => f.id));
    const caught = fish.filter((f) => this.slice.entries[f.id]).length;
    addText(this, area.x, area.y, `${caught} of ${fish.length} found`, { color: 'mist', shadow: false });
    addText(this, area.x + area.w, area.y, `${Math.round(pct * 100)}%`, { color: 'gold', shadow: false, originX: 1 });
    new ProgressBar(this, area.x, area.y + 13, area.w, 5, 'gold').setValue(pct);

    const cols = Math.max(1, Math.floor(area.w / CELL));
    const gap = Math.floor((area.w - cols * CELL) / Math.max(1, cols - 1));
    const scroll = new ScrollArea(this, { x: area.x, y: area.y + 22, w: area.w, h: area.h - 22 });
    fish.forEach((f, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * (CELL + gap);
      const y = row * (CELL + 2);
      const entry = this.slice.entries[f.id];
      const rarity = this.ctx.registries.rarities.get(f.rarity);
      const g = this.add.graphics();
      drawPanelBox(g, x, y, CELL, CELL, { fill: 'ink', border: entry ? rarity.frame : 'midnight' });
      if (entry) drawRarityShape(g, x + CELL - 9, y + 2, rarity.shape, rarity.color);
      // A gold corner marks a fish you have landed with a clean fight.
      if (entry?.clean) {
        g.fillStyle(color('gold'));
        g.fillRect(x + 2, y + CELL - 4, 2, 2);
        g.fillRect(x + 2, y + CELL - 6, 1, 2);
        g.fillRect(x + 4, y + CELL - 4, 2, 1);
      }
      scroll.add(g);
      const img = this.add.image(x + CELL / 2, y + CELL / 2 + 1, f.spriteKey);
      if (!entry) img.setTintFill(color('midnight'));
      scroll.add(img);
      const hit = new Button(this, {
        x,
        y,
        w: CELL,
        h: CELL,
        variant: 'ghost',
        onClick: () => this.scene.restart({ fishId: f.id }),
      });
      hit.setAlpha(0.001);
      scroll.add(hit);
    });
    scroll.setContentHeight(Math.ceil(fish.length / cols) * (CELL + 2));
  }

  private buildDetail(area: Rect, fishId: string): void {
    const r = this.ctx.registries;
    const f = r.fish.get(fishId);
    const rarity = r.rarities.get(f.rarity);
    const entry = this.slice.entries[fishId];
    const cx = area.x + area.w / 2;
    let y = area.y;

    const g = this.add.graphics();
    drawPanelBox(g, cx - 34, y, 68, 54, { fill: 'ink', border: entry ? rarity.frame : 'midnight' });
    const img = this.add.image(cx, y + 27, f.spriteKey).setScale(3);
    if (!entry) img.setTintFill(color('midnight'));
    y += 60;
    addText(this, cx, y, entry ? f.name : '???', { originX: 0.5 });
    y += 14;
    new RarityBanner(this, cx, y, { name: rarity.name, color: rarity.color, frame: rarity.frame, glow: rarity.glow, pips: rarity.pips, shape: rarity.shape }, !!entry);
    y += 20;

    const lines: string[] = [];
    if (entry) {
      lines.push(f.description, '');
      lines.push(`Caught: ${entry.count}`);
      lines.push(`Best size: ${entry.bestSize} cm`);
      if (entry.clean) lines.push(`Clean landings: ${entry.clean}`);
      lines.push(`First caught: ${new Date(entry.firstCaught).toLocaleDateString()}`);
    } else {
      lines.push('Not caught yet.', '');
    }
    const waters = f.waters.map((w) => r.waters.tryGet(w)?.name ?? w).join(', ');
    lines.push(`Waters: ${waters}`);
    if (f.timeOfDay.length) lines.push(`Time: ${f.timeOfDay.map((t) => TIME.phases.find((p) => p.id === t)?.name ?? t).join(', ')}`);
    if (f.weather.length) lines.push(`Weather: ${f.weather.map((w) => r.weather.tryGet(w)?.name ?? w).join(', ')}`);
    addText(this, area.x, y, lines.join('\n'), { maxWidth: area.w, color: 'sky', shadow: false });

    new Button(this, {
      x: area.x,
      y: area.y + area.h - 24,
      w: 60,
      h: 22,
      label: 'Back',
      variant: 'secondary',
      onClick: () => this.scene.restart({}),
    });
    this.input.keyboard?.on('keydown-BACKSPACE', () => this.scene.restart({}));
  }
}
