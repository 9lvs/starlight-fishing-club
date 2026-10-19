// Bottles: every note the line has brought up, to read again. A note opens on
// its own the moment its bottle is found.
import type { Rect } from '../../core/layout';
import { PanelScene } from '../../scenes/PanelScene';
import { Button } from '../../ui/Button';
import { drawPanelBox } from '../../ui/pixelDraw';
import { ScrollArea } from '../../ui/ScrollArea';
import { addText } from '../../ui/text';
import { color } from '../../design/tokens';
import { getFinds } from './service';
import type { NoteDef } from './state';

interface BottlesData {
  noteId?: string;
  /** Just found: say so above the note. */
  found?: boolean;
}

const ROW_H = 26;

export class BottlesScene extends PanelScene<BottlesData> {
  readonly title = 'Bottles';
  override readonly icon = 'icon_bottle';

  constructor() {
    super('Bottles');
  }

  protected build(area: Rect, data?: BottlesData): void {
    const note = data?.noteId ? getFinds().note(data.noteId) : undefined;
    if (note) this.buildNote(area, note, data?.found === true);
    else this.buildList(area);
  }

  private buildList(area: Rect): void {
    const finds = getFinds();
    const all = finds.notes();
    const found = finds.slice.found.map((id) => finds.note(id)).filter((n): n is NoteDef => !!n);
    addText(this, area.x, area.y, `${found.length} of ${all.length} bottles found`, { color: 'mist', shadow: false });
    if (found.length === 0) {
      addText(this, area.x, area.y + 20, 'Now and then a bottle comes up with the line. Notes from old club members wait inside.', {
        color: 'sky',
        maxWidth: area.w,
        shadow: false,
      });
      return;
    }
    const scroll = new ScrollArea(this, { x: area.x, y: area.y + 16, w: area.w, h: area.h - 16 });
    // Newest first.
    [...found].reverse().forEach((n, i) => {
      const y = i * (ROW_H + 2);
      const unread = finds.slice.unread.includes(n.id);
      const g = this.add.graphics();
      drawPanelBox(g, 0, y, area.w, ROW_H, { fill: 'ink', border: n.hintFor ? 'gold' : 'midnight' });
      if (unread) {
        g.fillStyle(color('coral'));
        g.fillRect(area.w - 7, y + 4, 3, 3);
      }
      scroll.add(g);
      scroll.add(this.add.image(11, y + ROW_H / 2, 'icon_bottle'));
      const where = n.water ? (this.ctx.registries.waters.tryGet(n.water)?.name ?? '') : 'Washed up';
      scroll.add(addText(this, 22, y + 3, `From ${n.from}`, { color: unread ? 'gold' : 'mist', shadow: false }));
      scroll.add(addText(this, 22, y + 14, n.hintFor ? `${where} · a clue` : where, { color: 'slate', shadow: false }));
      const hit = new Button(this, { x: 0, y, w: area.w, h: ROW_H, variant: 'ghost', onClick: () => this.refresh({ noteId: n.id }) });
      hit.setAlpha(0.001);
      scroll.add(hit);
    });
    scroll.setContentHeight(found.length * (ROW_H + 2));
  }

  private buildNote(area: Rect, n: NoteDef, justFound: boolean): void {
    getFinds().markRead(n.id);
    let y = area.y;
    if (justFound) {
      addText(this, area.x + area.w / 2, y, 'A bottle came up with the line!', { originX: 0.5, color: 'gold', shadow: false });
      y += 14;
    }
    // The note on a scrap of old paper (drawn first so it sits under the words).
    const pad = 6;
    const g = this.add.graphics();
    const body = addText(this, area.x + pad, y + pad, n.text, { color: 'ink', maxWidth: area.w - pad * 2, shadow: false });
    const sign = addText(this, area.x + area.w - pad, body.y + body.textHeight + 6, `- ${n.from}`, { color: 'bark', originX: 1, shadow: false });
    const h = sign.y + sign.textHeight + pad - y;
    drawPanelBox(g, area.x, y, area.w, h, { fill: 'sand', border: 'bark' });
    if (n.hintFor) {
      addText(this, area.x, y + h + 6, 'A clue to a secret fish. Its Journal page is sealed until you catch it.', { color: 'gold', maxWidth: area.w, shadow: false });
    }
    new Button(this, {
      x: area.x,
      y: area.y + area.h - 24,
      w: 70,
      h: 22,
      label: justFound ? 'Lovely' : 'Back',
      variant: 'secondary',
      onClick: () => (justFound ? this.close() : this.refresh({})),
    });
  }
}
