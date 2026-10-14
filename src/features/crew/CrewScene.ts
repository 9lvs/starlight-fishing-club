// Crew screen: hired helpers with their water and a live progress bar, and the
// helpers you can hire when a slot is free.
import type { Rect } from '../../core/layout';
import { ECONOMY } from '../../config/balance';
import { PanelScene } from '../../scenes/PanelScene';
import { Button } from '../../ui/Button';
import { drawPanelBox } from '../../ui/pixelDraw';
import { ProgressBar } from '../../ui/ProgressBar';
import { ScrollArea } from '../../ui/ScrollArea';
import { addText } from '../../ui/text';
import { formatNumber } from '../../ui/format';
import { getCrewService } from './service';

const ROW_H = 46;

export class CrewScene extends PanelScene {
  readonly title = 'Crew';
  override readonly icon = 'icon_crew';
  private bars: { bar: ProgressBar; id: string }[] = [];

  constructor() {
    super('Crew');
  }

  protected build(area: Rect): void {
    const svc = getCrewService();
    const r = this.ctx.registries;
    this.bars = [];
    addText(this, area.x, area.y, `Crew: ${svc.slice.members.length} of ${svc.slots} (bunks ${this.ctx.stats.get('crewBunks')})`, { color: 'mist', shadow: false });
    addText(this, area.x, area.y + 12, `Sell at ${Math.round(this.ctx.stats.get('crewSellMult') * 100)}%. Away, they fill your creel.`, {
      color: 'slate',
      shadow: false,
    });
    const scroll = new ScrollArea(this, { x: area.x, y: area.y + 26, w: area.w, h: area.h - 26 });
    let y = 0;

    for (const m of svc.slice.members) {
      const t = svc.type(m);
      const g = this.add.graphics();
      drawPanelBox(g, 0, y, area.w - 3, ROW_H - 4, { fill: 'ink', border: 'dusk' });
      scroll.add(g);
      if (t) scroll.add(this.add.sprite(4, y + 9, t.spriteKey, 0).setOrigin(0, 0));
      scroll.add(addText(this, 24, y + 3, t?.name ?? m.typeId, { color: 'mist', shadow: false }));
      scroll.add(addText(this, 24, y + 14, `${formatNumber(m.catches)} fish  +${formatNumber(m.earned)}`, { color: 'slate', shadow: false }));
      const unlocked = this.ctx.world.unlockedWaters();
      const waterName = r.waters.tryGet(m.waterId)?.name ?? m.waterId;
      scroll.add(
        new Button(this, {
          x: area.w - 82,
          y: y + 3,
          w: 76,
          h: 18,
          label: waterName.split(' ').slice(-1)[0] ?? waterName,
          icon: 'icon_map',
          variant: 'secondary',
          disabled: unlocked.length < 2,
          onClick: () => {
            const next = unlocked[(unlocked.indexOf(m.waterId) + 1) % unlocked.length]!;
            svc.assign(m.id, next);
            this.scene.restart();
          },
        }),
      );
      const bar = new ProgressBar(this, 24, y + 28, area.w - 32, 6, 'sage');
      scroll.add(bar);
      this.bars.push({ bar, id: m.id });
      y += ROW_H;
    }

    // Say which of the two limits is in the way: contracts (Hire Help) or bunks (the boat).
    if (svc.freeSlots === 0) {
      const contracts = this.ctx.stats.get('crewSlots');
      const bunks = this.ctx.stats.get('crewBunks');
      const why =
        bunks <= contracts
          ? bunks === 0
            ? 'Your boat has no crew bunk yet. A bigger boat (Painted Rowboat) has room.'
            : 'Your boat is full. A bigger boat has more bunks.'
          : 'Buy Hire Help in the Crew upgrades for another crew contract.';
      const t = addText(this, 0, y + 4, why, { color: 'sky', shadow: false, maxWidth: area.w - 6 });
      scroll.add(t);
      y += t.textHeight + 10;
    }

    const hireable = [...r.crewTypes.list()].filter((t) => !svc.isHired(t.id)).sort((a, b) => a.order - b.order);
    if (hireable.length > 0) {
      scroll.add(addText(this, 0, y + 4, 'Hire a helper', { color: 'gold', shadow: false }));
      y += 18;
    }
    for (const t of hireable) {
      const desc = addText(this, 24, 0, t.description, { color: 'slate', shadow: false, maxWidth: area.w - 30 });
      const rowH = Math.max(ROW_H - 4, 20 + desc.textHeight + 4);
      const g = this.add.graphics();
      drawPanelBox(g, 0, y, area.w - 3, rowH, { fill: 'midnight', border: 'midnight' });
      scroll.add(g);
      scroll.add(this.add.sprite(4, y + 4, t.spriteKey, 0).setOrigin(0, 0).setAlpha(svc.freeSlots > 0 ? 1 : 0.5));
      scroll.add(addText(this, 24, y + 4, t.name, { color: 'mist', shadow: false }));
      desc.setY(y + 18);
      scroll.add(desc);
      const currency = r.currencies.tryGet(t.currency ?? ECONOMY.defaultCurrency);
      scroll.add(
        new Button(this, {
          x: area.w - 62,
          y: y + 2,
          w: 56,
          h: 16,
          label: t.hireCost > 0 ? formatNumber(t.hireCost) : 'Free',
          icon: currency?.icon,
          variant: svc.canHire(t) ? 'primary' : 'secondary',
          disabled: !svc.canHire(t),
          onClick: () => {
            if (svc.hire(t.id)) this.ctx.ui.toast(`${t.name} joined the crew!`, { icon: 'icon_crew', color: 'gold' });
            this.scene.restart();
          },
        }),
      );
      y += rowH + 4;
    }
    scroll.setContentHeight(y);
  }

  override update(): void {
    const svc = getCrewService();
    for (const b of this.bars) {
      const m = svc.slice.members.find((x) => x.id === b.id);
      if (m) b.bar.setValue(m.progressMs / svc.intervalMs(m));
    }
  }
}
