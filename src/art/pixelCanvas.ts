// Tiny pixel drawing surface for placeholder art. Every color is a palette
// name, so placeholders always match the game's palette.
import { PALETTE, type PaletteName } from '../design/tokens';

/** Darker and lighter neighbours for each palette color, used for shading and outlines. */
export const SHADE_DOWN: Record<PaletteName, PaletteName> = {
  ink: 'midnight',
  midnight: 'ink',
  dusk: 'midnight',
  sky: 'dusk',
  mist: 'sky',
  gold: 'coral',
  coral: 'rose',
  rose: 'plum',
  plum: 'midnight',
  lavender: 'plum',
  teal: 'midnight',
  moss: 'midnight',
  sage: 'moss',
  slate: 'dusk',
  bark: 'midnight',
  sand: 'bark',
};

export const SHADE_UP: Record<PaletteName, PaletteName> = {
  ink: 'midnight',
  midnight: 'dusk',
  dusk: 'slate',
  sky: 'mist',
  mist: 'mist',
  gold: 'sand',
  coral: 'gold',
  rose: 'coral',
  plum: 'lavender',
  lavender: 'mist',
  teal: 'sky',
  moss: 'sage',
  sage: 'mist',
  slate: 'sky',
  bark: 'sand',
  sand: 'mist',
};

/** One character per palette color for ASCII stamps. "." is transparent. */
export const ASCII: Record<string, PaletteName> = {
  k: 'ink',
  n: 'midnight',
  d: 'dusk',
  s: 'sky',
  m: 'mist',
  g: 'gold',
  c: 'coral',
  r: 'rose',
  p: 'plum',
  l: 'lavender',
  t: 'teal',
  o: 'moss',
  e: 'sage',
  a: 'slate',
  b: 'bark',
  y: 'sand',
};

export class PixelCanvas {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private grid: (PaletteName | null)[];

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas is not available');
    this.ctx = ctx;
    this.grid = new Array(width * height).fill(null);
  }

  /** Draw at a frame offset when building a horizontal sprite sheet. */
  frame(index: number, frameWidth: number): FrameCanvas {
    return new FrameCanvas(this, index * frameWidth, frameWidth, this.height);
  }

  get(x: number, y: number): PaletteName | null {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    return this.grid[y * this.width + x] ?? null;
  }

  px(x: number, y: number, c: PaletteName | null): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.grid[y * this.width + x] = c;
    if (c === null) {
      this.ctx.clearRect(x, y, 1, 1);
    } else {
      this.ctx.fillStyle = '#' + PALETTE[c].toString(16).padStart(6, '0');
      this.ctx.fillRect(x, y, 1, 1);
    }
  }
}

/** A drawing view into one frame of a PixelCanvas. All coordinates are frame-local. */
export class FrameCanvas {
  constructor(
    private readonly base: PixelCanvas,
    private readonly ox: number,
    readonly width: number,
    readonly height: number,
  ) {}

  get(x: number, y: number): PaletteName | null {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    return this.base.get(this.ox + x, y);
  }

  px(x: number, y: number, c: PaletteName | null): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.base.px(this.ox + x, y, c);
  }

  rect(x: number, y: number, w: number, h: number, c: PaletteName): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: PaletteName): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Filled ellipse; centers may be fractional (6 means between pixels 5 and 6). */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: PaletteName): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.px(x, y, c);
      }
    }
  }

  disc(cx: number, cy: number, r: number, c: PaletteName): void {
    this.ellipse(cx, cy, r, r, c);
  }

  /** Fill a polygon given as points (even-odd rule, pixel centers). */
  poly(points: [number, number][], c: PaletteName): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const [xi, yi] = points[i]!;
          const [xj, yj] = points[j]!;
          if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) this.px(x, y, c);
      }
    }
  }

  /** Stamp ASCII art. Each char maps through ASCII; "." is skipped. */
  stamp(x: number, y: number, rows: readonly string[], remap: Record<string, PaletteName> = {}): void {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i]!;
        if (ch === '.' || ch === ' ') continue;
        const c = remap[ch] ?? ASCII[ch];
        if (c) this.px(x + i, y + j, c);
      }
    });
  }

  /** Add a 1px outline around everything drawn so far. */
  outline(c: PaletteName | ((inner: PaletteName) => PaletteName), diagonal = false): void {
    const marks: [number, number, PaletteName][] = [];
    const dirs = diagonal
      ? [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]
      : [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.get(x, y) !== null) continue;
        for (const [dx, dy] of dirs) {
          const n = this.get(x + dx!, y + dy!);
          if (n !== null) {
            marks.push([x, y, typeof c === 'function' ? c(n) : c]);
            break;
          }
        }
      }
    }
    for (const [x, y, col] of marks) this.px(x, y, col);
  }

  /** Recolor every pixel matching `from`. */
  recolor(from: PaletteName, to: PaletteName): void {
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) if (this.get(x, y) === from) this.px(x, y, to);
  }
}
