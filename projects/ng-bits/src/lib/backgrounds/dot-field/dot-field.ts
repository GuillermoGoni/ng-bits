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

/** How many slices the diagonal gradient is quantised into for batching. */
const GRADIENT_BANDS = 28;

/**
 * A fine grid of dots under a diagonal gradient. The pointer drags a lens
 * bulge and a soft glow across the field; dots can instead be pushed around
 * with spring physics by turning `bulgeOnly` off.
 *
 * ```html
 * <ngb-dot-field class="absolute inset-0 -z-10" gradientFrom="#A855F7" gradientTo="#B497CF" />
 * ```
 */
@Component({
  selector: 'ngb-dot-field',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbDotField extends NgbBackgroundBase {
  /** Radius of each dot, in CSS pixels. */
  readonly dotRadius = input(1.5, { transform: numberAttribute });
  /** Distance between dot centres, in CSS pixels. */
  readonly dotSpacing = input(14, { transform: numberAttribute });
  /** Radius of the pointer interaction area, in CSS pixels. */
  readonly cursorRadius = input(500, { transform: numberAttribute });
  /** Push strength used when `bulgeOnly` is off. */
  readonly cursorForce = input(0.1, { transform: numberAttribute });
  /** Bulge the dots away from the pointer instead of simulating physics. */
  readonly bulgeOnly = input(true, { transform: booleanAttribute });
  /** Strength of the lens bulge around the pointer. */
  readonly bulgeStrength = input(67, { transform: numberAttribute });
  /** Radius of the glow that follows the pointer, in CSS pixels. 0 disables it. */
  readonly glowRadius = input(160, { transform: numberAttribute });
  /** Colour of the pointer glow. Added on top, so dark values stay subtle. */
  readonly glowColor = input('#120F17');
  /** Let roughly 3% of the dots twinkle at a larger size. */
  readonly sparkle = input(false, { transform: booleanAttribute });
  /** Amplitude of the idle wave displacement, in CSS pixels. */
  readonly waveAmplitude = input(0, { transform: numberAttribute });
  /** Start colour of the diagonal gradient. */
  readonly gradientFrom = input('#A855F7');
  /** End colour of the diagonal gradient. */
  readonly gradientTo = input('#B497CF');

  protected override trackPointer = true;
  protected override pointerSmoothing = 0.18;

  private ctx!: CanvasRenderingContext2D;

  /** Rest positions, parallel arrays to keep the per-frame loop allocation-free. */
  private baseX = new Float32Array(0);
  private baseY = new Float32Array(0);
  private offsetX = new Float32Array(0);
  private offsetY = new Float32Array(0);
  private velocityX = new Float32Array(0);
  private velocityY = new Float32Array(0);
  private sparklePhase = new Float32Array(0);
  private isSparkle = new Uint8Array(0);

  /** Dot indices grouped by gradient band, built once per layout. */
  private bands: number[][] = [];
  private bandStyles: string[] = [];

  private fromRgb: Rgb = [0.66, 0.33, 0.97];
  private toRgb: Rgb = [0.71, 0.59, 0.81];

  constructor() {
    super();

    effect(() => {
      this.fromRgb = toRgb(this.gradientFrom(), [0.66, 0.33, 0.97]);
      this.toRgb = toRgb(this.gradientTo(), [0.71, 0.59, 0.81]);
      this.buildBandStyles();
      this.requestFrame();
    });

    effect(() => {
      // Layout inputs need the grid rebuilt, not just a repaint.
      this.dotSpacing();
      this.sparkle();
      this.buildGrid();
      this.requestFrame();
    });
  }

  protected setup(canvas: HTMLCanvasElement): void {
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    canvas.style.touchAction = 'none';
    this.buildBandStyles();
    this.buildGrid();
  }

  protected teardown(): void {
    this.bands = [];
  }

  protected onResize(): void {
    this.buildGrid();
  }

  protected frame(time: number, delta: number): void {
    if (!this.ctx || !this.baseX.length) return;

    const ctx = this.ctx;
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, this.viewWidth, this.viewHeight);

    this.drawGlow();
    this.integrate(time, delta);
    this.drawDots(time);
  }

  // --- Rendering ---------------------------------------------------------

  private drawGlow(): void {
    const radius = this.glowRadius();
    if (radius <= 0 || !this.pointer.inside) return;

    const [r, g, b] = toRgb(this.glowColor(), [0.07, 0.06, 0.09]);
    const cx = this.pointer.sx * this.viewWidth;
    const cy = this.pointer.sy * this.viewHeight;

    const gradient = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, rgbToCss([r, g, b], 1));
    gradient.addColorStop(1, rgbToCss([r, g, b], 0));

    // Additive, so a near-black glow colour reads as a gentle lift.
    this.ctx.globalCompositeOperation = 'lighter';
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    this.ctx.globalCompositeOperation = 'source-over';
  }

  /** Advance the spring physics used when `bulgeOnly` is off. */
  private integrate(_time: number, delta: number): void {
    if (this.bulgeOnly() || delta <= 0) return;

    const dt = Math.min(delta, 1 / 30);
    const radius = Math.max(this.cursorRadius(), 1);
    const force = this.cursorForce() * 12000;
    const inside = this.pointer.inside;
    const px = this.pointer.x;
    const py = this.pointer.y;

    for (let i = 0; i < this.baseX.length; i++) {
      if (inside) {
        const dx = this.baseX[i] + this.offsetX[i] - px;
        const dy = this.baseY[i] + this.offsetY[i] - py;
        const dist = Math.hypot(dx, dy);
        if (dist < radius && dist > 0.001) {
          const falloff = 1 - dist / radius;
          const push = (force * falloff * falloff) / dist;
          this.velocityX[i] += dx * push * dt;
          this.velocityY[i] += dy * push * dt;
        }
      }

      // Spring home, critically damped enough to settle without ringing.
      this.velocityX[i] += (-90 * this.offsetX[i] - 11 * this.velocityX[i]) * dt;
      this.velocityY[i] += (-90 * this.offsetY[i] - 11 * this.velocityY[i]) * dt;
      this.offsetX[i] += this.velocityX[i] * dt;
      this.offsetY[i] += this.velocityY[i] * dt;
    }
  }

  private drawDots(time: number): void {
    const ctx = this.ctx;
    const radius = this.dotRadius();
    const bulgeOnly = this.bulgeOnly();
    const cursorRadius = Math.max(this.cursorRadius(), 1);
    const bulge = this.bulgeStrength() / 100;
    const wave = this.waveAmplitude();
    const sparkle = this.sparkle();
    const inside = this.pointer.inside;
    const px = this.pointer.x;
    const py = this.pointer.y;

    // A bulge that peaks partway out reads as a lens; the centre dot holds still.
    const falloffScale = cursorRadius * 0.35;

    for (let band = 0; band < this.bands.length; band++) {
      const indices = this.bands[band];
      if (!indices.length) continue;

      ctx.fillStyle = this.bandStyles[band];
      ctx.beginPath();

      for (let n = 0; n < indices.length; n++) {
        const i = indices[n];
        let x = this.baseX[i] + this.offsetX[i];
        let y = this.baseY[i] + this.offsetY[i];

        if (wave !== 0) {
          y += Math.sin(x * 0.02 + time * 1.6 + y * 0.01) * wave;
        }

        if (bulgeOnly && inside) {
          const dx = x - px;
          const dy = y - py;
          const dist = Math.hypot(dx, dy);
          if (dist < cursorRadius) {
            const k = bulge * Math.exp(-((dist / falloffScale) ** 2));
            x += dx * k;
            y += dy * k;
          }
        }

        let r = radius;
        if (sparkle && this.isSparkle[i]) {
          r *= 1 + 0.9 * (0.5 + 0.5 * Math.sin(time * 2.2 + this.sparklePhase[i]));
        }

        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }

      ctx.fill();
    }
  }

  // --- Layout ------------------------------------------------------------

  private buildBandStyles(): void {
    this.bandStyles = Array.from({ length: GRADIENT_BANDS }, (_, i) =>
      rgbToCss(mixRgb(this.fromRgb, this.toRgb, i / (GRADIENT_BANDS - 1))),
    );
  }

  private buildGrid(): void {
    if (!this.ctx) return;

    const spacing = Math.max(this.dotSpacing(), 2);
    const cols = Math.max(1, Math.floor(this.viewWidth / spacing) + 1);
    const rows = Math.max(1, Math.floor(this.viewHeight / spacing) + 1);
    const total = cols * rows;

    // Centre the grid so it stays symmetric at any size.
    const startX = (this.viewWidth - (cols - 1) * spacing) / 2;
    const startY = (this.viewHeight - (rows - 1) * spacing) / 2;

    this.baseX = new Float32Array(total);
    this.baseY = new Float32Array(total);
    this.offsetX = new Float32Array(total);
    this.offsetY = new Float32Array(total);
    this.velocityX = new Float32Array(total);
    this.velocityY = new Float32Array(total);
    this.sparklePhase = new Float32Array(total);
    this.isSparkle = new Uint8Array(total);

    this.bands = Array.from({ length: GRADIENT_BANDS }, () => [] as number[]);

    const sparkle = this.sparkle();
    const width = Math.max(this.viewWidth, 1);
    const height = Math.max(this.viewHeight, 1);

    let i = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col * spacing;
        const y = startY + row * spacing;
        this.baseX[i] = x;
        this.baseY[i] = y;

        if (sparkle && Math.random() < 0.03) {
          this.isSparkle[i] = 1;
          this.sparklePhase[i] = Math.random() * Math.PI * 2;
        }

        // Diagonal position drives which slice of the gradient the dot takes.
        const t = (x / width + y / height) * 0.5;
        const band = Math.min(GRADIENT_BANDS - 1, Math.max(0, Math.round(t * (GRADIENT_BANDS - 1))));
        this.bands[band].push(i);

        i++;
      }
    }
  }
}
