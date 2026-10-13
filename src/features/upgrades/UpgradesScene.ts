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
import { attachTooltip } from '../../ui/Tooltip';
import { formatNumber } from '../../ui/format';
import { ECONOMY } from '../../config/balance';
import { color, type PaletteName } from '../../design/tokens';
import { layoutBranch, prereqList } from './logic';
import { getUpgradeService } from './service';

interface UpgradesData {
  branch?: string;
  selected?: string;
  /** Tree scroll offset to restore after a rebuild. */
  scroll?: number;
}

const TAB_H = 22;
/** Below this width a tab shows only its icon (the open tab always shows its name). */
const TAB_LABEL_MIN = 56;
const ROW_GAP = 14;
/** Below this content height the card drops "Leads to" and puts effects on one line. */
const COMPACT_BELOW = 230;

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
    const selected = data?.selected && nodes.some((n) => n.id === data.selected) ? data.selected : this.pickDefault(nodes);

    // Branch tabs. With many branches the open tab keeps its name and the rest show icons.
    const gap = 2;
    const n = Math.max(1, branches.length);
    const even = Math.floor((area.w - (n - 1) * gap) / n);
    const openW = even >= TAB_LABEL_MIN ? even : Math.min(64, area.w - (n - 1) * (gap + 22));
    const restW = even >= TAB_LABEL_MIN ? even : Math.floor((area.w - openW - (n - 1) * gap) / Math.max(1, n - 1));
    let tx = area.x;
    branches.forEach((b) => {
      const isOpen = b.id === branch;
      const w = isOpen ? openW : restW;
      const tab = new Button(this, {
        x: tx,
        y: area.y,
        w,
        h: TAB_H,
        label: isOpen || w >= TAB_LABEL_MIN ? b.name : undefined,
        icon: b.icon,
        variant: isOpen ? 'primary' : 'secondary',
        onClick: () => this.refresh({ branch: b.id }),
      });
      attachTooltip(this, tab.hit, () => b.name);
      const dot = r.upgrades.list().some((u) => u.branch === b.id && svc.state(u) === 'affordable');
      if (dot && !isOpen) this.add.rectangle(tab.x + w - 4, tab.y + 2, 2, 2, color('gold')).setOrigin(0, 0);
      tx += w + gap;
    });

    // Detail card first (it sizes to its text), then the tree fills what is left.
    let scrollRef: ScrollArea | null = null;
    const sel = nodes.find((n) => n.id === selected);
    const cardH = sel ? this.buildCard(area, sel, branch, () => scrollRef?.position ?? 0) : 0;

    // A branch can offer a panel above its tree (the Club tab opens the gem exchange).
    const b = r.branches.get(branch);
    let barH = 0;
    if (b.panel && this.scene.manager.keys[b.panel.sceneKey]) {
      const sceneKey = b.panel.sceneKey;
      new Button(this, {
        x: area.x,
        y: area.y + TAB_H + 3,
        w: area.w,
        h: 16,
        label: b.panel.label,
        icon: b.panel.sceneKey === 'Gems' ? 'icon_gem' : undefined,
        variant: 'secondary',
        onClick: () => this.ctx.ui.openPanel(sceneKey),
      });
      barH = 19;
    }

    // Tree.
    const treeRect = { x: area.x, y: area.y + TAB_H + 4 + barH, w: area.w, h: Math.max(TREE_NODE.h + 8, area.h - TAB_H - 4 - barH - cardH - 4) };
    const scroll = new ScrollArea(this, treeRect);
    scrollRef = scroll;
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
      const node = new TreeNode(this, p.x, p.y, u.icon ?? 'icon_star', () =>
        this.refresh({ branch, selected: u.id, scroll: scroll.position }),
      );
      node.setNode(svc.state(u), svc.level(u.id), u.maxLevel, u.id === selected, u.label, r.currencies.tryGet(u.currency ?? ECONOMY.defaultCurrency)?.icon);
      scroll.add(node);
    }
    const maxRow = Math.max(0, ...slots.map((s) => s.row));
    scroll.setContentHeight(8 + (maxRow + 1) * (TREE_NODE.h + ROW_GAP));
    // Come back to the same place after a rebuild; on first open, show the selected node.
    const selY = pos.get(selected ?? '')?.y ?? 0;
    scroll.scrollTo(data?.scroll ?? selY - TREE_NODE.h);


    this.listen('currencyChanged', () => this.refresh({ branch, selected, scroll: scroll.position }));
  }

  /** First node worth looking at: the next tier to buy, else the first node. */
  private pickDefault(nodes: readonly UpgradeDef[]): string | undefined {
    const svc = getUpgradeService();
    const open = nodes.filter((u) => svc.state(u) === 'affordable' || svc.state(u) === 'available');
    const tier = open.filter((u) => u.label).sort((a, b) => (a.position?.row ?? 0) - (b.position?.row ?? 0))[0];
    return (tier ?? open[0] ?? nodes[0])?.id;
  }

  /**
   * The detail card for the selected node, sized to its text and pinned to the
   * bottom of `area`: what it does now and next, every requirement with a check
   * or a lock, and what it leads to. Returns its height so the tree takes the rest.
   */
  private buildCard(area: Rect, u: UpgradeDef, branch: string, scrollPos: () => number): number {
    const svc = getUpgradeService();
    const r = this.ctx.registries;
    const level = svc.level(u.id);
    const state = svc.state(u);
    const maxed = level >= u.maxLevel;
    const compact = area.h < COMPACT_BELOW;
    const x = area.x;
    const w = area.w;
    const g = this.add.graphics();
    // Rows are created first, then stacked once their heights are known.
    const text = (t: string, c: PaletteName, dx = 4) => addText(this, x + dx, 0, t, { color: c, shadow: false, maxWidth: w - dx - 4 });
    const name = addText(this, x + 4, 0, u.name, { color: 'mist', shadow: false });
    const lv = addText(this, x + w - 4, 0, u.maxLevel > 1 ? `Lv ${level}/${u.maxLevel}` : maxed ? 'Owned' : '', { color: 'slate', shadow: false, originX: 1 });
    const desc = text(u.description, 'sky');

    // What it does: current value > value after the next level.
    const parts: string[] = [];
    if (!maxed) {
      for (const m of u.modifiers) {
        const def = this.ctx.stats.def(m.stat);
        const now = this.ctx.stats.get(m.stat);
        const next = this.ctx.stats.preview(m.stat, [{ ...modifierAtLevel(m, level + 1), source: `upgrade:${u.id}` }], `upgrade:${u.id}`);
        parts.push(`${def.label ?? m.stat} ${formatStat(def, now)} > ${formatStat(def, next)}`);
      }
      for (const e of u.effects) {
        const t = r.effects.tryGet(e.handler)?.describe?.(this.ctx, e.args ?? {});
        if (t) parts.push(t);
      }
    } else {
      parts.push('Fully upgraded');
    }
    const eff = text(parts.join(compact ? '  ' : '\n'), 'sage');

    // Requirements: each one listed, met or not, so the path is never a mystery.
    const reqs: { label: string; met: boolean }[] = [];
    if (!maxed) {
      for (const p of prereqList(u)) {
        const pu = r.upgrades.tryGet(p.id);
        if (pu) reqs.push({ label: p.level > 1 ? `${pu.name} level ${p.level}` : pu.name, met: svc.level(p.id) >= p.level });
      }
      if (u.requiresRank > 0) {
        const water = r.waters.list().find((wa) => wa.rangeRequired === u.requiresRank);
        reqs.push({ label: `Club at ${water?.name ?? `rank ${u.requiresRank}`}`, met: this.ctx.world.clubRank >= u.requiresRank });
      }
    }
    const reqRows = reqs.map((q) => ({
      icon: this.add.image(x + 4, 0, q.met ? 'icon_check' : 'icon_lock').setOrigin(0, 0),
      label: text(q.label, q.met ? 'sage' : 'sand', 18),
    }));
    const needsHead = reqRows.length > 0 ? text('Needs', 'mist') : null;

    // Leads to: what this opens up.
    const leads = compact
      ? []
      : r.upgrades
          .list()
          .filter((x2) => prereqList(x2).some((p) => p.id === u.id))
          .map((x2) => x2.name);
    const leadsText = leads.length > 0 ? text(`Leads to: ${leads.join(', ')}`, 'slate') : null;

    const showBuy = !maxed && reqs.every((q) => q.met);
    const footH = showBuy ? 24 : 4;
    let h = 15 + desc.textHeight + 3 + eff.textHeight + 4;
    if (needsHead) h += 12 + reqRows.reduce((s2, q) => s2 + Math.max(12, q.label.textHeight + 1), 0) + 2;
    if (leadsText) h += leadsText.textHeight + 3;
    h += footH;
    const y = area.y + area.h - h;
    drawPanelBox(g, x, y, w, h, { fill: 'ink', border: state === 'affordable' ? 'gold' : 'dusk' });
    name.setY(y + 3);
    lv.setY(y + 3);
    let cy = y + 15;
    desc.setY(cy);
    cy += desc.textHeight + 3;
    eff.setY(cy);
    cy += eff.textHeight + 4;
    if (needsHead) {
      needsHead.setY(cy);
      cy += 12;
      for (const q of reqRows) {
        q.icon.setY(cy - 1);
        q.label.setY(cy + 1);
        cy += Math.max(12, q.label.textHeight + 1);
      }
      cy += 2;
    }
    if (leadsText) {
      leadsText.setY(cy);
      cy += leadsText.textHeight + 3;
    }
    if (!showBuy) return h;
    const currency = r.currencies.tryGet(u.currency ?? ECONOMY.defaultCurrency);
    new Button(this, {
      x: x + w - 74,
      y: y + h - footH,
      w: 70,
      h: 20,
      label: formatNumber(svc.cost(u)),
      icon: currency?.icon,
      variant: state === 'affordable' ? 'primary' : 'secondary',
      disabled: state !== 'affordable',
      onClick: () => {
        if (svc.buy(u.id)) this.ctx.ui.toast(`${u.name} ${u.maxLevel > 1 ? `level ${svc.level(u.id)}` : 'bought'}`, { icon: u.icon });
        this.refresh({ branch, selected: u.id, scroll: scrollPos() });
      },
    });
    if (state !== 'affordable') {
      addText(this, x + 4, y + h - footH + 6, `${formatNumber(svc.cost(u) - this.ctx.wallet.get(u.currency ?? ECONOMY.defaultCurrency))} more ${(currency?.name ?? 'coins').toLowerCase()}`, {
        color: 'slate',
        shadow: false,
      });
    }
    return h;
  }
}
