// Composition root: the only place that knows about both the core and the
// feature list. Builds the context, starts Phaser, and wires browser events.
import type Phaser from 'phaser';
import { bootstrap, TickDriver } from './core/bootstrap';
import { loadContent } from './core/content/loadContent';
import { startGame } from './core/game';
import { applyViewport, currentViewport, sameViewport, updateLayout } from './core/viewport';
import { DISPLAY } from './config/display';
import { SAVE } from './config/tuning';
import { coreDebugCommands, withContentOptions } from './debug/coreCommands';
import { mountDebugPanel } from './debug/debugPanel';
import { showErrorScreen } from './debug/errorScreen';
import { FEATURES } from './features';
import { MemoryStorage, type StorageLike } from './systems/saveManager';
import { uiSignals } from './ui/uiSignals';
import { AudioManager } from './systems/audioManager';
import { wireAudio } from './core/audioWiring';
import './style.css';

const params = new URLSearchParams(location.search);
const debugParam = params.get('debug');
const styleguide = debugParam === 'styleguide';
const debug = import.meta.env.DEV || debugParam === '1' || styleguide;

function safeStorage(): StorageLike {
  try {
    const probe = '__sfc_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    console.warn('[save] localStorage is unavailable; progress will not persist');
    return new MemoryStorage();
  }
}

function main(): void {
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const boot = bootstrap({
    features: FEATURES,
    loadContent,
    storage: safeStorage(),
    debug,
    flags: { reducedMotion: prefersReduced },
  });
  if (!boot.ctx) {
    showErrorScreen(boot.errors);
    return;
  }
  const ctx = boot.ctx;
  uiSignals.reducedMotion = () => ctx.flags.reducedMotion === true;
  uiSignals.click = () => ctx.bus.emit('ui:click', {});

  wireAudio(ctx, new AudioManager());
  const ticker = new TickDriver(ctx, FEATURES);
  let vp = currentViewport();
  updateLayout(vp);
  const game: Phaser.Game = startGame({
    ctx,
    features: FEATURES,
    viewport: vp,
    styleguide,
    ticker,
    onReady: () => {
      // Catch up the time the tab was closed, then report a fresh or loaded save.
      if (!styleguide) ticker.startFrom(ctx.save.savedAt);
      ctx.bus.emit('saveLoaded', { fresh: ctx.save.savedAt === ctx.save.createdAt });
    },
  });

  // Keep the canvas sized to whole device pixels as the window changes.
  let resizeTimer = 0;
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const next = currentViewport();
      if (sameViewport(next, vp)) {
        updateLayout(next);
        return;
      }
      vp = next;
      applyViewport(game, vp);
      ctx.bus.emit('viewportChanged', { width: vp.width, height: vp.height });
    }, DISPLAY.resizeDebounceMs);
  };
  window.addEventListener('resize', onResize);
  window.visualViewport?.addEventListener('resize', onResize);

  // Autosave on a timer and whenever the page is hidden or closed.
  const save = () => {
    ctx.bus.emit('beforeSave', {});
    if (ctx.save.save()) ctx.bus.emit('saved', { at: ctx.clock.now() });
  };
  window.setInterval(save, SAVE.autosaveMs);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
  });
  window.addEventListener('pagehide', save);

  // No pinch zoom or double-tap zoom on iOS.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  if (debug && !styleguide) mountDebugPanel(ctx, withContentOptions(ctx, [...coreDebugCommands(), ...ctx.features.debugCommands()]));
  (window as unknown as { sfc?: unknown }).sfc = debug ? { ctx, game, ticker } : undefined;
}

main();
