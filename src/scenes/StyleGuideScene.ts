// Hidden style guide (?debug=styleguide): palette, type, every UI component in
// every state, rarity banners, and every placeholder sprite. Use it to check
// the look in one place and to review real art as it replaces placeholders.
import Phaser from 'phaser';
import { getContext } from '../core/context';
import { getLayout } from '../core/layout';
import { PALETTE_NAMES, SCENE_PALETTES, UI, color, type PaletteName } from '../design/tokens';
import { collectSpriteEntries } from './BootScene';
import { Button, type ButtonState, type ButtonVariant } from '../ui/Button';
import { Panel } from '../ui/Panel';
import { ProgressBar } from '../ui/ProgressBar';
import { RarityBanner } from '../ui/RarityBanner';
import { ScrollArea } from '../ui/ScrollArea';
import { Tooltip } from '../ui/Tooltip';
import { TreeNode, TREE_NODE, type NodeState } from '../ui/TreeNode';
import { drawPanelBox } from '../ui/pixelDraw';
import { addText } from '../ui/text';

export class StyleGuideScene extends Phaser.Scene {
  constructor() {
    super('StyleGuide');
  }

  create(): void {
    const ctx = getContext();
    const L = getLayout();
    this.cameras.main.setBackgroundColor(color('ink'));
    const area = new ScrollArea(this, { x: 0, y: 0, w: L.width, h: L.height });
    const pad = 6;
    const W = L.width - pad * 2;
    let y = pad;
    const add = (o: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[]) => area.add(o);
    const heading = (t: string) => {
      y += 4;
      add(addText(this, pad, y, t.toUpperCase(), { color: 'gold' }));
      y += 14;
    };

    add(addText(this, pad, y, 'Style Guide', { scale: 2, color: 'mist' }));
    y += 28;

    heading('Palette');
    PALETTE_NAMES.forEach((name, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = pad + col * Math.min(W / 2, 84);
      const yy = y + row * 14;
      add(this.add.rectangle(x, yy, 12, 12, color(name)).setOrigin(0, 0).setStrokeStyle(1, color('dusk')));
      add(addText(this, x + 15, yy + 1, name, { shadow: false, color: 'sky' }));
    });
    y += Math.ceil(PALETTE_NAMES.length / 2) * 14 + 4;

    heading('Scene palettes');
    for (const [phase, pal] of Object.entries(SCENE_PALETTES)) {
      add(addText(this, pad, y + 1, phase, { shadow: false, color: 'slate' }));
      const swatches: PaletteName[] = [...pal.skyBands, pal.hillsFar, pal.hillsNear, pal.waterTop, pal.waterDeep, pal.foreground];
      swatches.forEach((c, i) => add(this.add.rectangle(pad + 40 + i * 12, y, 11, 11, color(c)).setOrigin(0, 0)));
      y += 14;
    }

    heading('Type');
    add(addText(this, pad, y, 'Title text', { scale: 2 }));
    y += 24;
    const body = addText(this, pad, y, 'Body text: The quick brown fox fishes by the lazy pond. 0123456789', { maxWidth: W });
    add(body);
    y += body.textHeight + 4;
    add(addText(this, pad, y, 'Muted helper text', { color: 'slate', shadow: false }));
    y += 16;

    heading('Buttons');
    const variants: ButtonVariant[] = ['primary', 'secondary', 'ghost'];
    const states: ButtonState[] = ['normal', 'hover', 'pressed', 'disabled'];
    for (const v of variants) {
      states.forEach((s, i) => {
        const b = new Button(this, { x: pad + i * 42, y, w: 40, label: s.slice(0, 5), variant: v, onClick: () => {} });
        b.showState(s);
        add(b);
      });
      y += 30;
    }
    add(new Button(this, { x: pad, y, w: 88, h: 32, label: 'Cast', icon: 'icon_rod', variant: 'primary', onClick: () => {} }));
    const hl = new Button(this, { x: pad + 92, y, w: 72, h: 32, label: 'Reel in!', variant: 'primary', onClick: () => {} });
    hl.setHighlighted(true);
    add(hl);
    y += 40;

    heading('Panel, progress, tooltip');
    const panel = new Panel(this, { x: pad, y, w: Math.min(W, UI.panelMaxWidth), h: 60, title: 'Panel title', icon: 'icon_journal', onClose: () => {} });
    add(panel);
    y += 66;
    [0, 0.35, 0.7, 1].forEach((v, i) => add(new ProgressBar(this, pad + i * 42, y, 40, 6).setValue(v)));
    y += 12;
    const tip = new Tooltip(this, pad + 50, y + 22, 'A tooltip explains things');
    tip.setPosition(pad, y);
    add(tip);
    y += 22;
    const toast = this.add.graphics();
    drawPanelBox(toast, 0, 0, 120, 16, { fill: 'ink', border: 'dusk', highlight: 'midnight' });
    add(this.add.container(pad, y, [toast, addText(this, 5, 4, 'A gentle toast', { shadow: false })]));
    y += 22;

    heading('Rarity banners');
    for (const r of [...ctx.registries.rarities.list()].sort((a, b) => a.tier - b.tier)) {
      add(new RarityBanner(this, L.width / 2, y, { name: r.name, color: r.color, frame: r.frame, glow: r.glow, pips: r.pips, shape: r.shape }));
      y += 18;
    }

    heading('Tree nodes');
    const nodeStates: [NodeState, number, number][] = [
      ['locked', 0, 5],
      ['available', 0, 5],
      ['affordable', 1, 5],
      ['owned', 3, 5],
      ['maxed', 5, 5],
    ];
    nodeStates.forEach(([s, lvl, max], i) => {
      const n = new TreeNode(this, pad + i * (TREE_NODE.w + 2), y + 2, 'icon_rod', () => {});
      n.setNode(s, lvl, max, false);
      add(n);
    });
    y += TREE_NODE.h + 6;

    heading('Icons');
    const entries = collectSpriteEntries();
    const icons = entries.filter((e) => e.kind === 'icon');
    icons.forEach((e, i) => {
      const col = i % 8;
      const row = Math.floor(i / 8);
      add(this.add.image(pad + col * 20, y + row * 16, e.key).setOrigin(0, 0));
    });
    y += Math.ceil(icons.length / 8) * 16 + 4;

    heading('Boat tiers');
    // Each tier's rig (mast and sail) drawn behind its hull, as on the water.
    const tiers = entries.filter((e) => /^boat_\d+$/.test(e.key)).sort((a, b) => Number(a.key.slice(5)) - Number(b.key.slice(5)));
    tiers.forEach((e, i) => {
      const x = pad + (i % 5) * 34;
      const yy = y + Math.floor(i / 5) * 36;
      const rig = `rig_${e.key.slice(5)}`;
      if (this.textures.exists(rig)) add(this.add.image(x, yy, rig).setOrigin(0, 0));
      add(this.add.image(x, yy, e.key).setOrigin(0, 0));
    });
    y += Math.ceil(tiers.length / 5) * 36 + 4;

    heading('Sprites');
    for (const kind of ['boat', 'fisher', 'bobber', 'crew', 'water', 'decor', 'fx', 'fish'] as const) {
      const list = entries.filter((e) => e.kind === kind);
      add(addText(this, pad, y, kind, { color: 'slate', shadow: false }));
      y += 12;
      let x = pad;
      let rowH = 0;
      for (const e of list) {
        for (let f = 0; f < e.frames; f++) {
          if (x + e.width > L.width - pad) {
            x = pad;
            y += rowH + 3;
            rowH = 0;
          }
          add(this.add.image(x, y, e.key, f).setOrigin(0, 0));
          x += e.width + 3;
          rowH = Math.max(rowH, e.height);
        }
      }
      y += rowH + 6;
    }
    area.setContentHeight(y + pad);
  }
}
