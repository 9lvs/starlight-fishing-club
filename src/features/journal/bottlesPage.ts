// The Journal's Bottles page: every note the line has brought up, to read
// again. A note opens on its own the moment its bottle is found.
import type Phaser from 'phaser';
import type { GameContext } from '../../core/context';
import type { Rect } from '../../core/layout';
import { color } from '../../design/tokens';
import { Button } from '../../ui/Button';
import { drawPanelBox } from '../../ui/pixelDraw';
import { ScrollArea } from '../../ui/ScrollArea';
import { addText } from '../../ui/text';
import { getBottles } from './bottles';
import type { NoteDef } from './bottlesState';

/** What the page needs from the Journal panel that shows it. */
export interface BottlesHost {
  scene: Phaser.Scene;
  ctx: GameContext;
  /** Show one note, or the list when id is undefined. */
  open: (noteId?: string) => void;
  close: () => void;
}

const ROW_H = 26;

export function buildBottleList(h: BottlesHost, area: Rect): void {
  const { scene } = h;
  const bottles = getBottles();
  const all = bottles.notes();
  const found = bottles.slice.found.map((id) => bottles.note(id)).filter((n): n is NoteDef => !!n);
  addText(scene, area.x, area.y, `${found.length} of ${all.length} bottles found`, { color: 'mist', shadow: false });
  if (found.length === 0) {
    addText(scene, area.x, area.y + 20, 'Now and then a bottle comes up with the line. Notes from old club members wait inside.', {
      color: 'sky',
      maxWidth: area.w,
      shadow: false,
    });
    return;
  }
  const scroll = new ScrollArea(scene, { x: area.x, y: area.y + 16, w: area.w, h: area.h - 16 });
  // Newest first.
  [...found].reverse().forEach((n, i) => {
    const y = i * (ROW_H + 2);
    const unread = bottles.slice.unread.includes(n.id);
    const g = scene.add.graphics();
    drawPanelBox(g, 0, y, area.w, ROW_H, { fill: 'ink', border: n.hintFor ? 'gold' : 'midnight' });
    if (unread) {
      g.fillStyle(color('coral'));
      g.fillRect(area.w - 7, y + 4, 3, 3);
    }
    scroll.add(g);
    scroll.add(scene.add.image(11, y + ROW_H / 2, 'icon_bottle'));
    const where = n.water ? (h.ctx.registries.waters.tryGet(n.water)?.name ?? '') : 'Washed up';
    scroll.add(addText(scene, 22, y + 3, `From ${n.from}`, { color: unread ? 'gold' : 'mist', shadow: false }));
    scroll.add(addText(scene, 22, y + 14, n.hintFor ? `${where}, a clue` : where, { color: 'slate', shadow: false }));
    const hit = new Button(scene, { x: 0, y, w: area.w, h: ROW_H, variant: 'ghost', onClick: () => h.open(n.id) });
    hit.setAlpha(0.001);
    scroll.add(hit);
  });
  scroll.setContentHeight(found.length * (ROW_H + 2));
}

export function buildBottleNote(h: BottlesHost, area: Rect, n: NoteDef, justFound: boolean): void {
  const { scene } = h;
  getBottles().markRead(n.id);
  let y = area.y;
  if (justFound) {
    addText(scene, area.x + area.w / 2, y, 'A bottle came up with the line!', { originX: 0.5, color: 'gold', shadow: false });
    y += 14;
  }
  // The note on a scrap of old paper (drawn first so it sits under the words).
  const pad = 6;
  const g = scene.add.graphics();
  const body = addText(scene, area.x + pad, y + pad, n.text, { color: 'ink', maxWidth: area.w - pad * 2, shadow: false });
  const sign = addText(scene, area.x + area.w - pad, body.y + body.textHeight + 6, `- ${n.from}`, { color: 'bark', originX: 1, shadow: false });
  const ph = sign.y + sign.textHeight + pad - y;
  drawPanelBox(g, area.x, y, area.w, ph, { fill: 'sand', border: 'bark' });
  if (n.hintFor) {
    addText(scene, area.x, y + ph + 6, 'A clue to a secret fish. Its Journal page is sealed until you catch it.', { color: 'gold', maxWidth: area.w, shadow: false });
  }
  new Button(scene, {
    x: area.x,
    y: area.y + area.h - 24,
    w: 70,
    h: 22,
    label: justFound ? 'Lovely' : 'Back',
    variant: 'secondary',
    onClick: () => (justFound ? h.close() : h.open()),
  });
}
