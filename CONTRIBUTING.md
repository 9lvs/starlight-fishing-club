# Contributing

## Branch workflow

- `main` is always playable. Every commit on `main` must pass `npm run check`
  (typecheck, unit tests, production build).
- New work goes on a branch named `feature/<short-name>` (for example
  `feature/daily-gift`, `feature/glowing-cave`). Content-only additions may use
  `content/<short-name>`.
- Merge back into `main` only when `npm run check` passes and the game has been
  played for a minute on desktop and a phone.
- Each finished phase or release is tagged (`phase-0` ... `phase-9`, `v0.1.0`, ...).

## Before you commit

```bash
npm run check
```

## Rules of thumb

- Content goes in JSON under `src/content/<pack>/`, never in code.
- Gameplay systems beyond the core loop are features in `src/features/<name>/`
  and are registered only in `src/features/index.ts`.
- Pure logic (no Phaser imports) lives in `src/systems/` and `src/core/` and gets
  unit tests in `tests/`.
- Tuning numbers live in `src/config/` or content data. No magic numbers.
- Never punish the player: no fail states, no loss, no forced timers.

See `docs/ADDING_CONTENT.md` and `docs/ADDING_FEATURES.md` for recipes.
