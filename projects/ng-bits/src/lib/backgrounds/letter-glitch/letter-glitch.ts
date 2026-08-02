import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  effect,
  input,
  numberAttribute,
} from '@angular/core';

import { NGB_BACKGROUND_STYLES, NgbBackgroundBase } from '../../core/background-base';
import { Rgb, mixRgb, rgbToCss, toRgb } from '../../core/color';

const DEFAULT_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$&*()-_+=/[]{};:<>,.?';

interface Cell {
  char: string;
  from: Rgb;
  to: Rgb;
  /** 0..1 transition progress towards `to`. */
  progress: number;
}

/**
 * A terminal wall of characters that continuously reshuffles itself, fading
 * between palette colours. Canvas 2D.
 *
 * ```html
 * <ngb-letter-glitch class="absolute inset-0 -z-10"
 *   [colors]="['#2b4539','#61dca3','#61b3dc']" outerVignette />
 * ```
 */
@Component({
  selector: 'ngb-letter-glitch',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbLetterGlitch extends NgbBackgroundBase {
  /** Palette the characters are picked from. */
  readonly colors = input<readonly string[]>(['#2b4539', '#61dca3', '#61b3dc']);
  /** Characters to draw from. */
  readonly charset = input(DEFAULT_CHARSET);
  /** Cell width in CSS pixels. */
  readonly charWidth = input(10, { transform: numberAttribute });
  /** Cell height in CSS pixels. */
  readonly charHeight = input(20, { transform: numberAttribute });
  /** Glyph size in CSS pixels. */
  readonly fontSize = input(16, { transform: numberAttribute });
  /** Cells reshuffled per second, as a fraction of the grid. */
  readonly glitchRate = input(0.35, { transform: numberAttribute });
  /** Cross-fade colours instead of snapping. */
  readonly smooth = input(true, { transform: booleanAttribute });
  /** Seconds a colour cross-fade takes. */
  readonly fadeDuration = input(0.5, { transform: numberAttribute });
  /** Darken the edges of the element. */
  readonly outerVignette = input(false, { transform: booleanAttribute });
  /** Darken the middle of the element. */
  readonly centerVignette = input(false, { transform: booleanAttribute });
  /** Background painted behind the glyphs. Empty string leaves it transparent. */
  readonly backgroundColor = input('#000000');

  private ctx!: CanvasRenderingContext2D;
  private cells: Cell[] = [];
  private columns = 0;
  private rows = 0;
  private palette: Rgb[] = [];
  private charPool: string[] = [];
  /** Fractional cells carried over between frames, so low rates still tick. */
  private glitchDebt = 0;

  constructor() {
    super();
    effect(() => {
      const colors = this.colors();
      this.palette = colors.length ? colors.map((c) => toRgb(c)) : [[1, 1, 1]];
      this.charPool = Array.from(this.charset() || DEFAULT_CHARSET);
      this.requestFrame();
    });
    effect(() => {
      this.charWidth();
      this.charHeight();
      this.buildGrid();
      this.requestFrame();
    });
  }

  protected setup(canvas: HTMLCanvasElement): void {
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    this.buildGrid();
  }

  protected teardown(): void {
    this.cells = [];
  }

  protected onResize(): void {
    this.buildGrid();
  }

  protected frame(_time: number, delta: number): void {
    if (!this.ctx || !this.cells.length) return;

    const ctx = this.ctx;
    const cellW = Math.max(this.charWidth(), 2);
    const cellH = Math.max(this.charHeight(), 2);
    const smooth = this.smooth();
    const fade = Math.max(this.fadeDuration(), 0.001);

    this.reshuffle(delta);

    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, this.viewWidth, this.viewHeight);

    const background = this.backgroundColor();
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
    }

    ctx.font = `${this.fontSize()}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.textBaseline = 'top';

    for (let i = 0; i < this.cells.length; i++) {
      const cell = this.cells[i];
      if (smooth && cell.progress < 1) {
        cell.progress = Math.min(1, cell.progress + delta / fade);
      } else {
        cell.progress = 1;
      }

      const color = cell.progress >= 1 ? cell.to : mixRgb(cell.from, cell.to, cell.progress);
      ctx.fillStyle = rgbToCss(color);
      ctx.fillText(cell.char, (i % this.columns) * cellW, Math.floor(i / this.columns) * cellH);
    }

    this.drawVignettes();
  }

  /** Repaint a slice of the grid with fresh glyphs and colours. */
  private reshuffle(delta: number): void {
    const total = this.cells.length;
    this.glitchDebt += total * this.glitchRate() * delta;
    const count = Math.floor(this.glitchDebt);
    if (count <= 0) return;
    this.glitchDebt -= count;

    const smooth = this.smooth();
    for (let n = 0; n < count; n++) {
      const cell = this.cells[(Math.random() * total) | 0];
      const next = this.palette[(Math.random() * this.palette.length) | 0];
      cell.char = this.charPool[(Math.random() * this.charPool.length) | 0];
      cell.from = smooth ? (cell.progress >= 1 ? cell.to : mixRgb(cell.from, cell.to, cell.progress)) : next;
      cell.to = next;
      cell.progress = smooth ? 0 : 1;
    }
  }

  private drawVignettes(): void {
    const ctx = this.ctx;
    const w = this.viewWidth;
    const h = this.viewHeight;
    const radius = Math.hypot(w, h) / 2;

    if (this.outerVignette()) {
      const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, radius);
      gradient.addColorStop(0.6, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    }

    if (this.centerVignette()) {
      const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, radius * 0.6);
      gradient.addColorStop(0, 'rgba(0,0,0,0.85)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    }
  }

  private buildGrid(): void {
    if (!this.ctx) return;

    // setup() can beat the effects that fill these in, so seed them here too.
    if (!this.palette.length) {
      const colors = this.colors();
      this.palette = colors.length ? colors.map((c) => toRgb(c)) : [[1, 1, 1]];
    }
    if (!this.charPool.length) {
      this.charPool = Array.from(this.charset() || DEFAULT_CHARSET);
    }

    this.columns = Math.ceil(this.viewWidth / Math.max(this.charWidth(), 2));
    this.rows = Math.ceil(this.viewHeight / Math.max(this.charHeight(), 2));

    const total = Math.max(this.columns * this.rows, 0);
    const cells: Cell[] = new Array(total);
    for (let i = 0; i < total; i++) {
      const color = this.palette[(Math.random() * this.palette.length) | 0] ?? [1, 1, 1];
      cells[i] = {
        char: this.charPool[(Math.random() * this.charPool.length) | 0] ?? 'A',
        from: color,
        to: color,
        progress: 1,
      };
    }
    this.cells = cells;
  }
}
