// How to play: the game in short sections, and what the upgrade tags mean.
import { FOCUSES, LOOKS } from '../../config/focus';
import type { Rect } from '../../core/layout';
import { color } from '../../design/tokens';
import { PanelScene } from '../../scenes/PanelScene';
import { ScrollArea } from '../../ui/ScrollArea';
import { addText } from '../../ui/text';

const SECTIONS: { title: string; text: string }[] = [
  { title: 'Fishing', text: 'Tap Cast. When the bobber dips and "!" pops up, tap to reel in. Tap quickly for a quick-catch bonus.' },
  {
    title: 'Rare fish',
    text: 'A glow in the water means a rare fish is near. Rare fish fight back: tap each time the bobber dips, and hold at the end for a legendary. A clean fight pays +25%. Easy reel in Settings makes it one tap.',
  },
  {
    title: 'Your creel',
    text: 'Keep a catch to sell later. Fish sold together earn a bundle bonus, and more for 3, 5, or 10 of one rarity. Kept fish lose freshness while you play, so sell them soon.',
  },
  { title: 'Crew', text: 'Hire helpers in the Crew tab. Each needs a crew contract and a bunk on your boat. While you play they sell their catch; while you are away they fill your creel.' },
  {
    title: 'Moving the club',
    text: 'A better boat reaches the next water. Move the club there from the Map: coins and gear start over, but every fish sells for more. Gems and looks stay with you.',
  },
  { title: 'Goals and the Logbook', text: 'The goal bar in Upgrades shows your next step. The Logbook lists tasks for your water that pay coins, and moving the club pays gems.' },
  { title: 'Gems', text: 'A rare find on any catch, or traded for coins in the Club tab. They buy looks for your boat, fisher, and clubhouse.' },
];

export class HowToPlayScene extends PanelScene {
  readonly title = 'How to play';
  override readonly icon = 'icon_journal';

  constructor() {
    super('HowToPlay');
  }

  protected build(area: Rect): void {
    const scroll = new ScrollArea(this, area);
    const w = area.w - 6;
    let y = 0;
    for (const s of SECTIONS) {
      scroll.add(addText(this, 0, y, s.title, { color: 'gold' }));
      y += 12;
      const t = addText(this, 0, y, s.text, { color: 'sky', shadow: false, maxWidth: w });
      scroll.add(t);
      y += t.textHeight + 8;
    }
    // The upgrade tags, with the same colors as the marks in the tree.
    scroll.add(addText(this, 0, y, 'Upgrade tags', { color: 'gold' }));
    y += 12;
    const intro = addText(this, 0, y, 'The colored marks beside each upgrade, and the Helps line on its card, say what it improves:', { color: 'sky', shadow: false, maxWidth: w });
    scroll.add(intro);
    y += intro.textHeight + 5;
    for (const f of [...FOCUSES, LOOKS]) {
      const g = this.add.graphics();
      g.fillStyle(color('ink'));
      g.fillRect(0, y + 1, 6, 6);
      g.fillStyle(color(f.color));
      g.fillRect(1, y + 2, 4, 4);
      scroll.add(g);
      scroll.add(addText(this, 10, y, f.name, { color: f.color, shadow: false }));
      y += 11;
      const a = addText(this, 10, y, f.about, { color: 'slate', shadow: false, maxWidth: w - 10 });
      scroll.add(a);
      y += a.textHeight + 5;
    }
    scroll.setContentHeight(y + 4);
  }
}
