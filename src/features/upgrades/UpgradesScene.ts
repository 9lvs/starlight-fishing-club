// Upgrade tree: branch tabs, a scrollable node tree per branch with links
// between prerequisites, and a detail card with the effect preview and Buy.
import type Phaser from 'phaser';
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
import { focusesOf } from '../../config/focus';
import { nextGoal } from './goals';
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
/** The detail card never takes more than this share of the panel; longer text scrolls inside it. */
const CARD_MAX_SHARE = 0.45;

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
    const cardMax = Math.max(64, Math.floor(area.h * CARD_MAX_SHARE));
    const cardH = sel ? this.buildCard(area, sel, branch, () => scrollRef?.position ?? 0, cardMax) : 0;

    // The next goal on the journey, always in view; tap it to jump there.
    let barH = this.buildGoal(area.x, area.y + TAB_H + 3, area.w);

    // A branch can offer a panel above its tree (the Club tab opens the gem exchange).
    const b = r.branches.get(branch);
    if (b.panel && this.scene.manager.keys[b.panel.sceneKey]) {
      const sceneKey = b.panel.sceneKey;
      new Button(this, {
        x: area.x,
        y: area.y + TAB_H + 3 + barH,
        w: area.w,
        h: 16,
        label: b.panel.label,
        icon: b.panel.sceneKey === 'Gems' ? 'icon_gem' : undefined,
        variant: 'secondary',
        onClick: () => this.ctx.ui.openPanel(sceneKey),
      });
      barH += 19;
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
      // Colored marks down the left edge: what this upgrade helps (see focus.ts).
      const marks = this.add.graphics();
      focusesOf(u).forEach((f, i) => {
        marks.fillStyle(color('ink'));
        marks.fillRect(p.x - 5, p.y + 3 + i * 5, 4, 4);
        marks.fillStyle(color(f.color));
        marks.fillRect(p.x - 4, p.y + 4 + i * 5, 2, 2);
      });
      scroll.add(marks);
    }
    const maxRow = Math.max(0, ...slots.map((s) => s.row));
    scroll.setContentHeight(8 + (maxRow + 1) * (TREE_NODE.h + ROW_GAP));
    // Come back to the same place after a rebuild; on first open, show the selected node.
    const selY = pos.get(selected ?? '')?.y ?? 0;
    scroll.scrollTo(data?.scroll ?? selY - TREE_NODE.h);


    this.listen('currencyChanged', () => this.refresh({ branch, selected, scroll: scroll.position }));
  }

  /** The goal bar: the next step toward the next water, with coins saved so far. Returns its height. */
  private buildGoal(x: number, y: number, w: number): number {
    const svc = getUpgradeService();
    const world = this.ctx.world;
    const r = this.ctx.registries;
    const goal = nextGoal({
      clubRank: world.clubRank,
      nextWater: world.nextWater(),
      waterName: (id) => r.waters.tryGet(id)?.name ?? id,
      canMove: world.nextWater() !== null && world.canMoveTo(world.nextWater()!),
      upgrades: [...r.upgrades.list()].sort((a, b) => a.requiresRank - b.requiresRank || (a.position?.row ?? 0) - (b.position?.row ?? 0)),
      level: (id) => svc.level(id),
      cost: (u) => svc.cost(u),
    });
    const h = 22;
    const g = this.add.graphics();
    drawPanelBox(g, x, y, w, h, { fill: 'ink', border: goal.kind === 'move' ? 'gold' : 'dusk' });
    this.add.image(x + 3, y + 3, 'icon_flag').setOrigin(0, 0);
    let room = w - 21;
    if (goal.kind === 'buy') {
      const have = this.ctx.wallet.get(goal.upgrade.currency ?? ECONOMY.defaultCurrency);
      const count = addText(this, x + w - 4, y + 3, `${formatNumber(Math.min(have, goal.cost))}/${formatNumber(goal.cost)}`, { color: 'slate', shadow: false, originX: 1 });
      room -= count.textWidth + 4;
      const p = Math.min(1, have / Math.max(1, goal.cost));
      g.fillStyle(color('midnight'));
      g.fillRect(x + 17, y + h - 6, w - 21, 3);
      g.fillStyle(color(p >= 1 ? 'gold' : 'sage'));
      g.fillRect(x + 17, y + h - 6, Math.round((w - 21) * p), 3);
    }
    // Longest wording that fits on one line, never running into the coin count.
    const label = addText(this, x + 17, y + 3, '', { color: goal.kind === 'move' ? 'gold' : 'mist', shadow: false });
    const tries = goal.kind === 'buy' ? [`Next goal: ${goal.short}`, `Next: ${goal.short}`, goal.short] : [goal.short];
    let fit = tries.find((t) => (label.setText(t), label.textWidth <= room));
    if (!fit) {
      let t = tries[tries.length - 1]!;
      while (t.length > 3 && (label.setText(`${t}..`), label.textWidth > room)) t = t.slice(0, -1);
      fit = `${t}..`;
    }
    label.setText(fit);
    const hit = this.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    attachTooltip(this, hit, () => goal.text);
    hit.on('pointerup', () => {
      this.ctx.bus.emit('ui:click', {});
      if (goal.kind === 'buy') this.refresh({ branch: goal.upgrade.branch, selected: goal.upgrade.id });
      else if (goal.kind === 'move') {
        this.close();
        this.ctx.ui.openPanel('Map');
      }
    });
    return h + 3;
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
  private buildCard(area: Rect, u: UpgradeDef, branch: string, scrollPos: () => number, maxH: number): number {
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
    const helps = text(`Helps: ${focusesOf(u).map((f) => f.name).join(', ')}`, focusesOf(u)[0]?.color ?? 'mist');

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
    const head = 15;
    // Lay the body out from 0, then place it: directly if it fits, else in a scroll area.
    const body: Phaser.GameObjects.GameObject[] = [helps, desc, eff];
    let by = 0;
    helps.setY(by);
    by += helps.textHeight + 2;
    desc.setY(by);
    by += desc.textHeight + 3;
    eff.setY(by);
    by += eff.textHeight + 4;
    if (needsHead) {
      body.push(needsHead);
      needsHead.setY(by);
      by += 12;
      for (const q of reqRows) {
        body.push(q.icon, q.label);
        q.icon.setY(by - 1);
        q.label.setY(by + 1);
        by += Math.max(12, q.label.textHeight + 1);
      }
      by += 2;
    }
    if (leadsText) {
      body.push(leadsText);
      leadsText.setY(by);
      by += leadsText.textHeight + 3;
    }
    const bodyH = Math.min(by, maxH - head - footH);
    const h = head + bodyH + footH;
    const y = area.y + area.h - h;
    drawPanelBox(g, x, y, w, h, { fill: 'ink', border: state === 'affordable' ? 'gold' : 'dusk' });
    name.setY(y + 3);
    lv.setY(y + 3);
    if (by <= bodyH) {
      for (const o of body) (o as unknown as { y: number }).y += y + head;
    } else {
      // Long cards scroll inside, so the tree above always stays in view.
      const scroll = new ScrollArea(this, { x, y: y + head, w, h: bodyH });
      for (const o of body) (o as unknown as { x: number }).x -= x;
      scroll.add(body);
      scroll.setContentHeight(by);
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
