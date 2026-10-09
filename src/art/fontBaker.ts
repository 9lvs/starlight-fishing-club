// Bakes the TTF pixel font into a Phaser bitmap font at boot. Browser text
// rendering anti-aliases glyph edges, which looks blurry at 180x320, so each
// glyph is rasterized once and its alpha is thresholded to hard pixels.
// Glyphs are white so BitmapText tint can color them with palette colors.
import type Phaser from 'phaser';
import { TYPOGRAPHY } from '../design/tokens';

const EXTRA_CHARS = '•…×';

export function fontCharset(): string {
  let s = '';
  for (let c = 32; c <= 126; c++) s += String.fromCharCode(c);
  return s + EXTRA_CHARS;
}

/** Load the bundled TTF. Resolves false (and the fallback font is used) if it fails. */
export async function loadPixelFont(): Promise<boolean> {
  try {
    const face = new FontFace(TYPOGRAPHY.fontFamily, `url(${TYPOGRAPHY.fontFile})`);
    await face.load();
    document.fonts.add(face);
    return true;
  } catch (err) {
    console.warn('[font] Pixelify Sans failed to load, using fallback', err);
    return false;
  }
}

interface Glyph {
  code: number;
  width: number;
  image: ImageData;
}

export function bakeBitmapFont(scene: Phaser.Scene, fontLoaded: boolean): void {
  const size = TYPOGRAPHY.bakeSize;
  const family = fontLoaded ? `"${TYPOGRAPHY.fontFamily}"` : TYPOGRAPHY.fallbackFamily;
  const ascent = TYPOGRAPHY.ascentPx;
  const cellH = ascent + TYPOGRAPHY.descentPx;

  const scratch = document.createElement('canvas');
  scratch.width = size * 3;
  scratch.height = cellH;
  const sctx = scratch.getContext('2d', { willReadFrequently: true });
  if (!sctx) throw new Error('2d canvas is not available');
  sctx.font = `${size}px ${family}`;
  sctx.textBaseline = 'alphabetic';

  const glyphs: Glyph[] = [];
  for (const ch of fontCharset()) {
    const width = Math.max(1, Math.round(sctx.measureText(ch).width));
    sctx.clearRect(0, 0, scratch.width, scratch.height);
    sctx.fillStyle = '#ffffff';
    sctx.fillText(ch, fontLoaded ? TYPOGRAPHY.gridOffsetX : 0, ascent + (fontLoaded ? TYPOGRAPHY.gridOffsetY : 0));
    const img = sctx.getImageData(0, 0, width, cellH);
    const px = img.data;
    for (let i = 0; i < px.length; i += 4) {
      const on = (px[i + 3] ?? 0) >= TYPOGRAPHY.alphaThreshold;
      px[i] = 255;
      px[i + 1] = 255;
      px[i + 2] = 255;
      px[i + 3] = on ? 255 : 0;
    }
    glyphs.push({ code: ch.charCodeAt(0), width, image: img });
  }

  // Pack glyphs into rows with 1px padding.
  const atlasW = 256;
  let x = 1;
  let y = 1;
  const places: { g: Glyph; x: number; y: number }[] = [];
  for (const g of glyphs) {
    if (x + g.width + 1 > atlasW) {
      x = 1;
      y += cellH + 1;
    }
    places.push({ g, x, y });
    x += g.width + 1;
  }
  const atlasH = y + cellH + 1;
  const atlas = document.createElement('canvas');
  atlas.width = atlasW;
  atlas.height = atlasH;
  const actx = atlas.getContext('2d');
  if (!actx) throw new Error('2d canvas is not available');
  for (const p of places) actx.putImageData(p.g.image, p.x, p.y);

  const key = TYPOGRAPHY.bitmapKey;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, atlas);

  const chars: Record<number, unknown> = {};
  for (const p of places) {
    chars[p.g.code] = {
      x: p.x,
      y: p.y,
      width: p.g.width,
      height: cellH,
      centerX: Math.floor(p.g.width / 2),
      centerY: Math.floor(cellH / 2),
      xOffset: 0,
      yOffset: 0,
      xAdvance: p.g.width + TYPOGRAPHY.letterSpacing,
      data: {},
      kerning: {},
      u0: p.x / atlasW,
      v0: p.y / atlasH,
      u1: (p.x + p.g.width) / atlasW,
      v1: (p.y + cellH) / atlasH,
    };
  }
  const data = { font: key, size: cellH, lineHeight: cellH + TYPOGRAPHY.lineSpacing, chars };
  scene.cache.bitmapFont.add(key, { data, texture: key, frame: null });
}
