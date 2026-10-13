// "While you were away": a gentle tally of what the crew did.
import type { Rect } from '../../core/layout';
import type { OfflineReport } from '../../core/types';
import { PanelScene } from '../../scenes/PanelScene';
import { Button } from '../../ui/Button';
import { addText } from '../../ui/text';
import { formatDuration, formatNumber } from '../../ui/format';

export interface OfflineSummaryData {
  elapsedMs: number;
  appliedMs: number;
  reports: OfflineReport[];
}

export class OfflineSummaryScene extends PanelScene<OfflineSummaryData> {
  readonly title = 'While you were away';
  override readonly icon = 'icon_moon';

  constructor() {
    super('OfflineSummary');
  }

  protected build(area: Rect, data?: OfflineSummaryData): void {
    if (!data) return;
    const cx = area.x + area.w / 2;
    let y = area.y + 4;
    addText(this, cx, y, `You were away ${formatDuration(data.elapsedMs)}`, { originX: 0.5, color: 'mist' });
    y += 16;
    if (data.appliedMs < data.elapsedMs) {
      const t = addText(this, cx, y, `Your crew rested after ${formatDuration(data.appliedMs)}.\nA Cozy Hammock lets them fish longer.`, {
        originX: 0.5,
        align: 'center',
        color: 'slate',
        shadow: false,
        maxWidth: area.w,
      });
      y += t.textHeight + 8;
    }
    const totals: Record<string, number> = {};
    let kept = 0;
    for (const r of data.reports) {
      kept += r.kept ?? 0;
      addText(this, area.x, y, r.title, { color: 'gold' });
      y += 14;
      const t = addText(this, area.x + 4, y, r.lines.join('\n'), { color: 'sky', shadow: false, maxWidth: area.w - 4 });
      y += t.textHeight + 8;
      for (const [c, n] of Object.entries(r.earned ?? {})) totals[c] = (totals[c] ?? 0) + n;
    }
    if (kept > 0) {
      this.add.image(cx - 34, y + 2, 'icon_creel').setOrigin(0, 0);
      addText(this, cx - 18, y + 3, `+${formatNumber(kept)} fish`, { color: 'sky', scale: 2 });
      y += 30;
    }
    for (const [c, n] of Object.entries(totals)) {
      if (n <= 0) continue;
      const cur = this.ctx.registries.currencies.tryGet(c);
      if (cur) this.add.image(cx - 34, y + 2, cur.icon).setOrigin(0, 0);
      addText(this, cx - 18, y + 3, `+${formatNumber(n)}`, { color: cur?.color ?? 'gold', scale: 2 });
      y += 30;
    }
    new Button(this, {
      x: Math.round(cx - 40),
      y: area.y + area.h - 30,
      w: 80,
      h: 26,
      label: 'Lovely!',
      variant: 'primary',
      onClick: () => this.close(),
    });
  }
}
