// Map: every water from waters.json. Unlocked waters can be sailed to; locked
// ones say what opens them; "coming soon" waters tease future content.
import type { Rect } from '../../core/layout';
import { PanelScene } from '../../scenes/PanelScene';
import { Button } from '../../ui/Button';
import { drawPanelBox } from '../../ui/pixelDraw';
import { ScrollArea } from '../../ui/ScrollArea';
import { addText } from '../../ui/text';

const STATUS_H = 22;

export class MapScene extends PanelScene {
  readonly title = 'Map';
  override readonly icon = 'icon_map';

  constructor() {
    super('Map');
  }

  /**
   * Which upgrade opens a water: the Nth cheapest upgrade that raises boatRange,
   * where N is the water's rangeRequired. Purely derived from data.
   */
  private unlockHint(rangeRequired: number): string {
    const rangeUps = this.ctx.registries.upgrades
      .list()
      .filter((u) => u.modifiers.some((m) => m.stat === 'boatRange' && m.op === 'add' && m.value > 0))
      .sort((a, b) => a.baseCost - b.baseCost);
    const u = rangeUps[rangeRequired - 1];
    return u ? `Needs ${u.name}` : 'Needs more boat range';
  }

  protected build(area: Rect): void {
    const r = this.ctx.registries;
    const world = this.ctx.world;
    const waters = [...r.waters.list()].sort((a, b) => a.order - b.order);
    const scroll = new ScrollArea(this, area);
    let y = 0;
    for (const w of waters) {
      const unlocked = world.isUnlocked(w.id);
      const here = world.waterId === w.id;
      const desc = addText(this, 40, 0, w.description, { color: unlocked ? 'sky' : 'slate', shadow: false, maxWidth: area.w - 46 });
      const statusY = Math.max(30, 16 + desc.textHeight + 2);
      const cardH = statusY + STATUS_H;
      const g = this.add.graphics();
      drawPanelBox(g, 0, y, area.w - 3, cardH, {
        fill: here ? 'dusk' : 'ink',
        border: here ? 'gold' : unlocked ? 'sky' : 'midnight',
      });
      scroll.add(g);
      const icon = this.add.image(4, y + 4, w.spriteKey).setOrigin(0, 0);
      if (!unlocked) icon.setAlpha(0.35);
      scroll.add(icon);
      scroll.add(addText(this, 40, y + 4, w.name, { color: unlocked ? 'mist' : 'slate', shadow: false }));
      desc.setY(y + 16);
      scroll.add(desc);
      const sy = y + statusY;
      if (w.comingSoon) {
        scroll.add(addText(this, 6, sy + 4, 'Coming soon', { color: 'lavender', shadow: false }));
      } else if (!unlocked) {
        scroll.add(this.add.image(4, sy + 2, 'icon_lock').setOrigin(0, 0));
        scroll.add(addText(this, 20, sy + 4, this.unlockHint(w.rangeRequired), { color: 'slate', shadow: false }));
      } else if (here) {
        scroll.add(addText(this, 6, sy + 4, 'You are here', { color: 'gold', shadow: false }));
      } else {
        scroll.add(
          new Button(this, {
            x: 4,
            y: sy,
            w: 70,
            h: 18,
            label: 'Sail here',
            icon: 'icon_boat',
            variant: 'primary',
            onClick: () => {
              if (world.setWater(w.id)) this.ctx.ui.toast(`Sailing to ${w.name}`, { icon: 'icon_boat' });
              this.close();
            },
          }),
        );
      }
      y += cardH + 4;
    }
    scroll.setContentHeight(y);
  }
}
