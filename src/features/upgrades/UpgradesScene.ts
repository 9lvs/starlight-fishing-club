// Upgrade tree: branch tabs, a scrollable node tree per branch with links
// between prerequisites, and a detail card with the effect preview and Buy.
import type { Rect } from '../../core/layout';
import type { UpgradeDef } from '../../core/content/schemas';
import { formatStat, modifierAtLevel } from '../../core/stats';
import { PanelScene } from '../../scenes/PanelScene';
import { Button } from '../../ui/Button';
import { drawPanelBox, drawPixelLine } from '../../ui/pixelDraw';
import { ScrollArea } from '../../ui/ScrollArea';
import { TreeNode, TREE_NODE } from '../../ui/TreeNode';
import { addText } from '../../ui/text';
import { formatNumber } from '../../ui/format';
import { ECONOMY } from '../../config/balance';
import { color } from '../../design/tokens';
import { layoutBranch, prereqList } from './logic';
import { getUpgradeService } from './service';

interface UpgradesData {
  branch?: string;
  selected?: string;
}

const TAB_H = 22;
const CARD_H = 74;
const ROW_GAP = 14;

export class UpgradesScene extends PanelScene<UpgradesData> {
  readonly title = 'Upgrades';
  override readonly icon = 'icon_star';

  constructor() {
    super('Upgrades');
  }

  protected build(area: Rect, data?: UpgradesData): void {
    const r = this.ctx.registries;
    const branches = [...r.branches.list()].sort((a, b) => a.order - b.order);
    const branch = data?.branch && r.branches.has(data.branch) ? data.branch : (branches[0]?.id ?? '');
    const svc = getUpgradeService();
    const nodes = r.upgrades.list().filter((u) => u.branch === branch);
    const selected = data?.selected && nodes.some((n) => n.id === data.selected) ? data.selected : nodes[0]?.id;

    // Branch tabs.
    const tabW = Math.floor((area.w - (branches.length - 1) * 2) / Math.max(1, branches.length));
    branches.forEach((b, i) => {
      const tab = new Button(this, {
        x: area.x + i * (tabW + 2),
        y: area.y,
        w: tabW,
        h: TAB_H,
        label: b.name,
        icon: b.icon,
        variant: b.id === branch ? 'primary' : 'secondary',
        onClick: () => this.scene.restart({ branch: b.id }),
      });
      const dot = r.upgrades.list().some((u) => u.branch === b.id && svc.state(u) === 'affordable');
      if (dot && b.id !== branch) this.add.rectangle(tab.x + tabW - 4, tab.y + 2, 2, 2, color('gold')).setOrigin(0, 0);
    });

    // Tree.
    const treeRect = { x: area.x, y: area.y + TAB_H + 4, w: area.w, h: area.h - TAB_H - 4 - CARD_H - 4 };
    const scroll = new ScrollArea(this, treeRect);
    const slots = layoutBranch(nodes);
    const maxCol = Math.max(0, ...slots.map((s) => s.col));
    const cols = maxCol + 1;
    const spacing = Math.max(TREE_NODE.w + 4, Math.floor((treeRect.w - 4) / Math.max(1, cols)));
    const left = Math.round((treeRect.w - (cols - 1) * spacing - TREE_NODE.w) / 2);
    const pos = new Map(slots.map((s) => [s.id, { x: left + s.col * spacing, y: 4 + s.row * (TREE_NODE.h + ROW_GAP) }]));

    const links = this.add.graphics();
    scroll.add(links);
    for (const u of nodes) {
      const to = pos.get(u.id)!;
      for (const p of prereqList(u)) {
        const from = pos.get(p.id);
        if (!from) continue;
        const met = svc.level(p.id) >= p.level;
        const x0 = from.x + TREE_NODE.w / 2;
        const y0 = from.y + TREE_NODE.h;
        const x1 = to.x + TREE_NODE.w / 2;
        const y1 = to.y;
        const mid = Math.round((y0 + y1) / 2);
        const c = met ? 'sage' : 'dusk';
        drawPixelLine(links, x0, y0, x0, mid, c);
        drawPixelLine(links, x0, mid, x1, mid, c);
        drawPixelLine(links, x1, mid, x1, y1, c);
      }
    }
    for (const u of nodes) {
      const p = pos.get(u.id)!;
      const node = new TreeNode(this, p.x, p.y, u.icon ?? 'icon_star', () => this.scene.restart({ branch, selected: u.id }));
      node.setNode(svc.state(u), svc.level(u.id), u.maxLevel, u.id === selected);
      scroll.add(node);
    }
    const maxRow = Math.max(0, ...slots.map((s) => s.row));
    scroll.setContentHeight(8 + (maxRow + 1) * (TREE_NODE.h + ROW_GAP));

    const sel = nodes.find((n) => n.id === selected);
    if (sel) this.buildCard({ x: area.x, y: area.y + area.h - CARD_H, w: area.w, h: CARD_H }, sel, branch);

    this.listen('currencyChanged', () => this.scene.restart({ branch, selected }));
  }

  private buildCard(rect: Rect, u: UpgradeDef, branch: string): void {
    const svc = getUpgradeService();
    const level = svc.level(u.id);
    const state = svc.state(u);
    const g = this.add.graphics();
    drawPanelBox(g, rect.x, rect.y, rect.w, rect.h, { fill: 'ink', border: state === 'affordable' ? 'gold' : 'dusk' });
    addText(this, rect.x + 4, rect.y + 3, u.name, { color: 'mist', shadow: false });
    addText(this, rect.x + rect.w - 4, rect.y + 3, `Lv ${level}/${u.maxLevel}`, { color: 'slate', shadow: false, originX: 1 });
    addText(this, rect.x + 4, rect.y + 15, u.description, { color: 'sky', shadow: false, maxWidth: rect.w - 8 });

    // Effect preview: current value -> value after the next level.
    let effect = '';
    if (level < u.maxLevel) {
      const parts = u.modifiers.map((m) => {
        const def = this.ctx.stats.def(m.stat);
        const now = this.ctx.stats.get(m.stat);
        const next = this.ctx.stats.preview(m.stat, [{ ...modifierAtLevel(m, level + 1), source: `upgrade:${u.id}` }], `upgrade:${u.id}`);
        return `${def.label ?? m.stat} ${formatStat(def, now)} > ${formatStat(def, next)}`;
      });
      for (const e of u.effects) {
        const text = this.ctx.registries.effects.tryGet(e.handler)?.describe?.(this.ctx, e.args ?? {});
        if (text) parts.push(text);
      }
      effect = parts.join('  ');
    } else {
      effect = 'Fully upgraded';
    }
    addText(this, rect.x + 4, rect.y + rect.h - 36, effect, { color: 'sage', shadow: false, maxWidth: rect.w - 8 });

    const missing = svc.missing(u);
    if (missing.length > 0) {
      addText(this, rect.x + 4, rect.y + rect.h - 15, `Needs ${missing.map((m) => m.name).join(', ')}`, {
        color: 'slate',
        shadow: false,
        maxWidth: rect.w - 8,
      });
      return;
    }
    if (level >= u.maxLevel) return;
    const currency = this.ctx.registries.currencies.tryGet(u.currency ?? ECONOMY.defaultCurrency);
    new Button(this, {
      x: rect.x + rect.w - 74,
      y: rect.y + rect.h - 22,
      w: 70,
      h: 20,
      label: formatNumber(svc.cost(u)),
      icon: currency?.icon,
      variant: state === 'affordable' ? 'primary' : 'secondary',
      disabled: state !== 'affordable',
      onClick: () => {
        if (svc.buy(u.id)) this.ctx.ui.toast(`${u.name} ${u.maxLevel > 1 ? `level ${svc.level(u.id)}` : 'bought'}`, { icon: u.icon });
        this.scene.restart({ branch, selected: u.id });
      },
    });
  }
}
