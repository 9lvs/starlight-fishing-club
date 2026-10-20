// A small HTML dialog for things a canvas is bad at: copying and pasting text
// (save export and import). Styled with the palette.
import { cssColor } from '../design/tokens';

export interface DialogOptions {
  title: string;
  text?: string;
  value?: string;
  readOnly?: boolean;
  /** A one-line field (with the right phone keyboard) instead of the big text box. */
  input?: 'email';
  placeholder?: string;
  confirmLabel?: string;
  onConfirm?: (value: string, setError: (msg: string) => void) => void;
}

export function openDomDialog(o: DialogOptions): () => void {
  const backdrop = document.createElement('div');
  Object.assign(backdrop.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '30',
    background: 'rgba(11,16,38,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'auto',
  });
  const box = document.createElement('div');
  Object.assign(box.style, {
    width: 'min(360px, calc(100vw - 32px))',
    background: cssColor('midnight'),
    border: `2px solid ${cssColor('dusk')}`,
    borderRadius: '6px',
    padding: '14px',
    color: cssColor('mist'),
    font: '14px/1.4 ui-monospace, Menlo, monospace',
    boxSizing: 'border-box',
  });
  const h = document.createElement('div');
  h.textContent = o.title;
  Object.assign(h.style, { color: cssColor('gold'), fontWeight: 'bold', marginBottom: '8px' });
  box.appendChild(h);
  if (o.text) {
    const p = document.createElement('div');
    p.textContent = o.text;
    Object.assign(p.style, { color: cssColor('sky'), marginBottom: '8px' });
    box.appendChild(p);
  }
  const ta: HTMLTextAreaElement | HTMLInputElement = o.input ? document.createElement('input') : document.createElement('textarea');
  if (ta instanceof HTMLInputElement) {
    ta.type = o.input!;
    ta.autocomplete = o.input!;
    ta.inputMode = o.input!;
    Object.assign(ta.style, { padding: '8px', fontSize: '16px' });
  } else ta.rows = 5;
  if (o.placeholder) ta.placeholder = o.placeholder;
  ta.value = o.value ?? '';
  ta.readOnly = !!o.readOnly;
  Object.assign(ta.style, {
    width: '100%',
    boxSizing: 'border-box',
    background: cssColor('ink'),
    color: cssColor('mist'),
    border: `1px solid ${cssColor('dusk')}`,
    font: '12px ui-monospace, Menlo, monospace',
    wordBreak: 'break-all',
    userSelect: 'text',
  });
  box.appendChild(ta);
  const err = document.createElement('div');
  Object.assign(err.style, { color: cssColor('coral'), minHeight: '1.4em', margin: '6px 0' });
  box.appendChild(err);
  const row = document.createElement('div');
  Object.assign(row.style, { display: 'flex', gap: '8px', justifyContent: 'flex-end' });
  const button = (label: string, primary: boolean) => {
    const b = document.createElement('button');
    b.textContent = label;
    Object.assign(b.style, {
      background: primary ? cssColor('coral') : cssColor('dusk'),
      color: primary ? cssColor('ink') : cssColor('mist'),
      border: '0',
      borderRadius: '4px',
      padding: '8px 12px',
      minHeight: '40px',
      font: 'inherit',
    });
    row.appendChild(b);
    return b;
  };
  const close = () => backdrop.remove();
  if (o.readOnly) {
    const copy = button('Copy', true);
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(ta.value);
        err.style.color = cssColor('sage');
        err.textContent = 'Copied!';
      } catch {
        ta.select();
        err.textContent = 'Select the text and copy it.';
      }
    });
  }
  if (o.onConfirm) {
    const ok = button(o.confirmLabel ?? 'OK', true);
    const confirm = () => o.onConfirm!(ta.value, (m) => (err.textContent = m));
    ok.addEventListener('click', confirm);
    if (o.input) ta.addEventListener('keydown', (e) => (e as KeyboardEvent).key === 'Enter' && confirm());
  }
  button('Close', false).addEventListener('click', close);
  box.appendChild(row);
  backdrop.appendChild(box);
  backdrop.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (e.target === backdrop) close();
  });
  document.body.appendChild(backdrop);
  if (o.readOnly) ta.select();
  else ta.focus();
  return close;
}
