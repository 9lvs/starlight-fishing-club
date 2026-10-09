// DOM debug panel, shown in dev builds and with ?debug=1. Plain HTML so it can
// use real inputs and copyable output without touching the game's pixel UI.
import type { GameContext } from '../core/context';
import type { DebugCommand } from '../core/feature';

export function mountDebugPanel(ctx: GameContext, commands: DebugCommand[]): void {
  const toggle = document.createElement('button');
  toggle.className = 'sfc-debug-toggle';
  toggle.textContent = 'debug';
  const panel = document.createElement('div');
  panel.className = 'sfc-debug';
  panel.hidden = true;
  const out = document.createElement('pre');

  for (const cmd of commands) {
    const row = document.createElement('div');
    row.className = 'cmd';
    const inputs: Record<string, HTMLInputElement | HTMLSelectElement> = {};
    for (const arg of cmd.args ?? []) {
      let el: HTMLInputElement | HTMLSelectElement;
      if (arg.type === 'select') {
        el = document.createElement('select');
        for (const o of arg.options ?? []) {
          const opt = document.createElement('option');
          opt.value = o;
          opt.textContent = o;
          el.appendChild(opt);
        }
      } else {
        el = document.createElement('input');
        el.type = arg.type === 'number' ? 'number' : 'text';
      }
      el.value = String(arg.default ?? '');
      el.title = arg.name;
      inputs[arg.name] = el;
      row.appendChild(el);
    }
    const btn = document.createElement('button');
    btn.textContent = cmd.label;
    btn.addEventListener('click', () => {
      const args: Record<string, string | number> = {};
      for (const a of cmd.args ?? []) {
        const v = inputs[a.name]?.value ?? '';
        args[a.name] = a.type === 'number' ? Number(v) : v;
      }
      try {
        out.textContent = cmd.run(ctx, args) ?? 'done';
      } catch (err) {
        out.textContent = `Error: ${(err as Error).message}`;
      }
    });
    row.prepend(btn);
    panel.appendChild(row);
  }
  panel.appendChild(out);
  toggle.addEventListener('click', () => (panel.hidden = !panel.hidden));
  // Keep debug clicks from reaching the game canvas.
  for (const el of [toggle, panel]) {
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.body.appendChild(el);
  }
}
