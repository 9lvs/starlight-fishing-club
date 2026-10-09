// Shown instead of the game when content fails validation, so a typo in a
// JSON file is obvious and points at the exact file, entry, and field.

export function showErrorScreen(errors: string[]): void {
  const root = document.createElement('div');
  root.className = 'sfc-error';
  const h = document.createElement('h1');
  h.textContent = 'Some game content needs a fix';
  const p = document.createElement('p');
  p.textContent = 'The game did not start because these content entries are invalid:';
  const ul = document.createElement('ul');
  for (const e of errors) {
    const li = document.createElement('li');
    li.textContent = e;
    ul.appendChild(li);
  }
  root.append(h, p, ul);
  document.body.appendChild(root);
  console.error('[content]\n' + errors.join('\n'));
}
