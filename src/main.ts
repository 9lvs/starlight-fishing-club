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
  uiSignals.deny = () => ctx.bus.emit('ui:deny', {});

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
  // Some mobile browsers report the new size a moment after rotating.
  window.addEventListener('orientationchange', () => {
    onResize();
    window.setTimeout(onResize, DISPLAY.orientationSettleMs);
  });

  // A gentle zoom of the whole canvas (the legendary moment). Done with CSS on
  // the upscaled canvas, so game pixels stay crisp instead of being resampled.
  // The edge glow sits over the canvas, so the zoom never pushes it off screen.
  const edgeGlow = document.createElement('div');
  edgeGlow.className = 'edge-glow';
  document.getElementById('game')?.appendChild(edgeGlow);
  ctx.bus.on('camera:zoom', (z) => {
    const canvas = game.canvas;
    if (!canvas) return;
    if ('reset' in z) {
      canvas.style.transition = `transform ${z.outMs}ms ease-in-out`;
      canvas.style.transform = '';
      edgeGlow.style.transition = `opacity ${z.outMs}ms ease-in-out`;
      edgeGlow.style.opacity = '0';
      return;
    }
    if (z.glow) {
      edgeGlow.style.setProperty('--glow', z.glow);
      edgeGlow.style.transition = `opacity ${z.inMs}ms ease-out`;
      edgeGlow.style.opacity = '1';
    }
    if (ctx.flags.reducedMotion) return;
    canvas.style.transformOrigin = `${z.x * vp.cssZoom}px ${z.y * vp.cssZoom}px`;
    canvas.style.transition = `transform ${z.inMs}ms ease-out`;
    canvas.style.transform = `scale(${z.scale})`;
  });

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

// Offline play and "Add to Home Screen" (production builds only, so dev always loads fresh files).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('[sw] not registered', err));
  });
}
