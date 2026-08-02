import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  numberAttribute,
} from '@angular/core';

import { NGB_BACKGROUND_STYLES, NgbBackgroundBase } from '../../core/background-base';
import { Rgb, rgbToCss, toRgb } from '../../core/color';

/** Direction the grid drifts towards. */
export type NgbGridDirection = 'diagonal' | 'up' | 'right' | 'down' | 'left';

/** Tile drawn at each grid position. */
export type NgbGridShape = 'square' | 'hexagon' | 'circle' | 'triangle';

const DIRECTIONS: Record<NgbGridDirection, [number, number]> = {
  diagonal: [1, 1],
  up: [0, -1],
  right: [1, 0],
  down: [0, 1],
  left: [-1, 0],
};

/** One cell the pointer has visited, kept alive for the fading trail. */
interface TrailCell {
  col: number;
  row: number;
  /** Seconds remaining before the cell is fully faded. */
  life: number;
}

/** Seconds a trail cell takes to fade out. */
const TRAIL_LIFETIME = 0.6;

/**
 * A drifting grid of outlined tiles that fill in under the pointer, with an
 * optional fading trail behind it and a vignette that sinks the edges into
 * the page background.
 *
 * ```html
 * <ngb-shape-grid class="absolute inset-0 -z-10" shape="square" direction="diagonal" />
 * ```
 */
@Component({
  selector: 'ngb-shape-grid',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbShapeGrid extends NgbBackgroundBase {
  /** Tile drawn at each grid position. */
  readonly shape = input<NgbGridShape>('square');
  /** Direction the grid drifts towards. */
  readonly direction = input<NgbGridDirection>('diagonal');
  /** Tile size in CSS pixels. */
  readonly squareSize = input(40, { transform: numberAttribute });
  /** Drift speed multiplier. */
  readonly speed = input(0.5, { transform: numberAttribute });
  /** Colour of the tile outlines. */
  readonly borderColor = input('#2F293A');
  /** Fill colour of the tile under the pointer. */
  readonly hoverFillColor = input('#222222');
  /** How many previously hovered tiles stay visible as a fading trail. */
  readonly hoverTrailAmount = input(0, { transform: numberAttribute });
  /** Colour the vignette sinks the edges into. Empty string disables it. */
  readonly vignetteColor = input('#060010');

  protected override trackPointer = true;

  private ctx!: CanvasRenderingContext2D;
  private offsetX = 0;
  private offsetY = 0;
  private borderRgb: Rgb = [0.18, 0.16, 0.23];
  private hoverRgb: Rgb = [0.13, 0.13, 0.13];
  private trail: TrailCell[] = [];

  constructor() {
    super();
    effect(() => {
      this.borderRgb = toRgb(this.borderColor(), [0.18, 0.16, 0.23]);
      this.hoverRgb = toRgb(this.hoverFillColor(), [0.13, 0.13, 0.13]);
      this.requestFrame();
    });
  }

  protected setup(canvas: HTMLCanvasElement): void {
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    canvas.style.touchAction = 'none';
  }

  protected teardown(): void {
    this.trail = [];
  }

  protected onResize(): void {
    this.requestFrame();
  }

  protected frame(_time: number, delta: number): void {
    if (!this.ctx) return;

    const size = Math.max(this.squareSize(), 4);
    const rowStep = this.shape() === 'hexagon' ? size * 0.866 : size;

    this.advance(delta, size, rowStep);
    this.updateTrail(delta, size, rowStep);

    const ctx = this.ctx;
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, this.viewWidth, this.viewHeight);

    this.drawGrid(size, rowStep);
    this.drawVignette();
  }

  // --- Motion ------------------------------------------------------------

  private advance(delta: number, size: number, rowStep: number): void {
    const [dx, dy] = DIRECTIONS[this.direction()] ?? DIRECTIONS.diagonal;
    const distance = this.speed() * 60 * delta;

    // Wrap by one cell so the grid never drifts away from the origin.
    this.offsetX = (this.offsetX + dx * distance) % size;
    this.offsetY = (this.offsetY + dy * distance) % rowStep;
  }

  private updateTrail(delta: number, size: number, rowStep: number): void {
    const limit = Math.max(0, Math.round(this.hoverTrailAmount()));

    for (const cell of this.trail) cell.life -= delta;
    this.trail = this.trail.filter((cell) => cell.life > 0);

    if (limit === 0 || !this.pointer.inside) {
      if (limit === 0) this.trail.length = 0;
      return;
    }

    const hovered = this.cellAt(this.pointer.x, this.pointer.y, size, rowStep);
    if (!hovered) return;

    const existing = this.trail.find((c) => c.col === hovered.col && c.row === hovered.row);
    if (existing) {
      existing.life = TRAIL_LIFETIME;
    } else {
      this.trail.push({ ...hovered, life: TRAIL_LIFETIME });
      if (this.trail.length > limit) this.trail.splice(0, this.trail.length - limit);
    }
  }

  // --- Drawing -----------------------------------------------------------

  private drawGrid(size: number, rowStep: number): void {
    const ctx = this.ctx;
    const width = this.viewWidth;
    const height = this.viewHeight;
    const shape = this.shape();

    const startCol = Math.floor(this.offsetX / size) - 1;
    const startRow = Math.floor(this.offsetY / rowStep) - 1;
    const cols = Math.ceil(width / size) + 2;
    const rows = Math.ceil(height / rowStep) + 2;

    const hovered = this.pointer.inside
      ? this.cellAt(this.pointer.x, this.pointer.y, size, rowStep)
      : null;

    ctx.lineWidth = 1;
    ctx.strokeStyle = rgbToCss(this.borderRgb);

    // Fills first, so no outline is painted over by a neighbouring fill.
    for (const cell of this.trail) {
      const alpha = (cell.life / TRAIL_LIFETIME) * 0.65;
      ctx.fillStyle = rgbToCss(this.hoverRgb, alpha);
      ctx.beginPath();
      this.tracePath(cell.col, cell.row, size, rowStep, shape);
      ctx.fill();
    }

    if (hovered) {
      ctx.fillStyle = rgbToCss(this.hoverRgb);
      ctx.beginPath();
      this.tracePath(hovered.col, hovered.row, size, rowStep, shape);
      ctx.fill();
    }

    // One path for every outline: a single stroke call for the whole grid.
    ctx.beginPath();
    for (let r = startRow; r < startRow + rows; r++) {
      for (let c = startCol; c < startCol + cols; c++) {
        this.tracePath(c, r, size, rowStep, shape);
      }
    }
    ctx.stroke();
  }

  /** Adds one tile's outline to the current path. */
  private tracePath(
    col: number,
    row: number,
    size: number,
    rowStep: number,
    shape: NgbGridShape,
  ): void {
    const ctx = this.ctx;
    // Hexagons interlock by shifting every other row half a cell.
    const stagger = shape === 'hexagon' && Math.abs(row % 2) === 1 ? size * 0.5 : 0;
    const x = col * size - this.offsetX + stagger;
    const y = row * rowStep - this.offsetY;

    switch (shape) {
      case 'circle': {
        const r = size * 0.42;
        ctx.moveTo(x + size / 2 + r, y + rowStep / 2);
        ctx.arc(x + size / 2, y + rowStep / 2, r, 0, Math.PI * 2);
        break;
      }

      case 'triangle': {
        const inset = size * 0.08;
        ctx.moveTo(x + size / 2, y + inset);
        ctx.lineTo(x + size - inset, y + rowStep - inset);
        ctx.lineTo(x + inset, y + rowStep - inset);
        ctx.closePath();
        break;
      }

      case 'hexagon': {
        const cx = x + size / 2;
        const cy = y + rowStep / 2;
        const r = size * 0.5;
        for (let i = 0; i < 6; i++) {
          // Pointy-top orientation, matching the staggered rows.
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          const px = cx + Math.cos(angle) * r;
          const py = cy + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      }

      default:
        ctx.rect(x, y, size, rowStep);
        break;
    }
  }

  private drawVignette(): void {
    const color = this.vignetteColor();
    if (!color) return;

    const rgb = toRgb(color, [0.02, 0, 0.06]);
    const w = this.viewWidth;
    const h = this.viewHeight;
    const radius = Math.hypot(w, h) / 2;

    const gradient = this.ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, radius);
    gradient.addColorStop(0, rgbToCss(rgb, 0));
    gradient.addColorStop(1, rgbToCss(rgb, 1));
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, w, h);
  }

  // --- Geometry ----------------------------------------------------------

  /** Which cell covers a point, in the same coordinates {@link tracePath} uses. */
  private cellAt(
    x: number,
    y: number,
    size: number,
    rowStep: number,
  ): { col: number; row: number } | null {
    const row = Math.floor((y + this.offsetY) / rowStep);
    const stagger = this.shape() === 'hexagon' && Math.abs(row % 2) === 1 ? size * 0.5 : 0;
    const col = Math.floor((x + this.offsetX - stagger) / size);
    return { col, row };
  }
}
