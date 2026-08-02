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

interface Dot {
  /** Rest position, in CSS pixels. */
  x: number;
  y: number;
  /** Displacement from rest. */
  ox: number;
  oy: number;
  /** Velocity of the displacement, px/s. */
  vx: number;
  vy: number;
}

/**
 * A grid of dots that light up near the pointer and get blown outwards by a
 * click, springing back with inertia. Canvas 2D — no WebGL context used.
 *
 * ```html
 * <ngb-dot-grid class="absolute inset-0 -z-10" baseColor="#27272a" activeColor="#5227ff" />
 * ```
 */
@Component({
  selector: 'ngb-dot-grid',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbDotGrid extends NgbBackgroundBase {
  /** Dot radius in CSS pixels. */
  readonly dotSize = input(4, { transform: numberAttribute });
  /** Distance between dot centres, in CSS pixels. */
  readonly gap = input(24, { transform: numberAttribute });
  /** Colour of a dot at rest. */
  readonly baseColor = input('#27272a');
  /** Colour a dot reaches directly under the pointer. */
  readonly activeColor = input('#5227ff');
  /** Radius of the pointer highlight, in CSS pixels. */
  readonly proximity = input(140, { transform: numberAttribute });
  /** Radius of the click shockwave, in CSS pixels. Set to 0 to disable. */
  readonly shockRadius = input(240, { transform: numberAttribute });
  /** Peak velocity imparted by a click, in px/s. */
  readonly shockStrength = input(900, { transform: numberAttribute });
  /** Spring stiffness pulling dots home. */
  readonly stiffness = input(120, { transform: numberAttribute });
  /** Spring damping. Higher settles faster. */
  readonly damping = input(12, { transform: numberAttribute });
  /** Let the pointer push dots aside as it moves. */
  readonly repel = input(false, { transform: booleanAttribute });

  protected override trackPointer = true;

  private ctx!: CanvasRenderingContext2D;
  private dots: Dot[] = [];
  private baseRgb: Rgb = [0.15, 0.15, 0.16];
  private activeRgb: Rgb = [0.32, 0.15, 1];

  constructor() {
    super();
    effect(() => {
      this.baseRgb = toRgb(this.baseColor(), [0.15, 0.15, 0.16]);
      this.activeRgb = toRgb(this.activeColor(), [0.32, 0.15, 1]);
      this.requestFrame();
    });
    effect(() => {
      // Layout inputs need the grid rebuilt, not just a repaint.
      this.dotSize();
      this.gap();
      this.buildGrid();
      this.requestFrame();
    });
  }

  protected setup(canvas: HTMLCanvasElement): void {
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    canvas.style.touchAction = 'none';
    this.hostRef.nativeElement.addEventListener('pointerdown', this.handlePointerDown);
    this.buildGrid();
  }

  protected teardown(): void {
    this.hostRef.nativeElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.dots = [];
  }

  protected onResize(): void {
    this.buildGrid();
  }

  protected frame(_time: number, delta: number): void {
    if (!this.ctx) return;

    const dt = Math.min(delta, 1 / 30);
    const stiffness = this.stiffness();
    const damping = this.damping();
    const radius = this.dotSize();
    const proximity = Math.max(this.proximity(), 1);
    const proximitySq = proximity * proximity;
    const repel = this.repel();
    const pointerActive = this.pointer.inside;
    const px = this.pointer.x;
    const py = this.pointer.y;

    const ctx = this.ctx;
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, this.viewWidth, this.viewHeight);

    const restStyle = rgbToCss(this.baseRgb);
    const highlighted: { dot: Dot; t: number }[] = [];

    // Pass 1: integrate springs and batch every resting dot into one path.
    ctx.fillStyle = restStyle;
    ctx.beginPath();

    for (const dot of this.dots) {
      if (dt > 0 && (dot.ox !== 0 || dot.oy !== 0 || dot.vx !== 0 || dot.vy !== 0)) {
        dot.vx += (-stiffness * dot.ox - damping * dot.vx) * dt;
        dot.vy += (-stiffness * dot.oy - damping * dot.vy) * dt;
        dot.ox += dot.vx * dt;
        dot.oy += dot.vy * dt;

        // Snap to rest once the motion is sub-pixel, so the path batch grows back.
        if (Math.abs(dot.ox) < 0.01 && Math.abs(dot.oy) < 0.01 &&
            Math.abs(dot.vx) < 0.05 && Math.abs(dot.vy) < 0.05) {
          dot.ox = dot.oy = dot.vx = dot.vy = 0;
        }
      }

      const x = dot.x + dot.ox;
      const y = dot.y + dot.oy;

      let t = 0;
      if (pointerActive) {
        const dx = x - px;
        const dy = y - py;
        const distSq = dx * dx + dy * dy;
        if (distSq < proximitySq) {
          t = 1 - Math.sqrt(distSq) / proximity;
          if (repel && dt > 0) {
            const dist = Math.max(Math.sqrt(distSq), 0.001);
            const push = t * t * 600;
            dot.vx += (dx / dist) * push * dt;
            dot.vy += (dy / dist) * push * dt;
          }
        }
      }

      if (t > 0.001) {
        highlighted.push({ dot, t });
        continue;
      }

      ctx.moveTo(x + radius, y);
      ctx.arc(x, y, radius, 0, Math.PI * 2);
    }

    ctx.fill();

    // Pass 2: the handful of dots near the pointer, each with its own colour.
    for (const { dot, t } of highlighted) {
      const eased = t * t;
      ctx.fillStyle = rgbToCss(mixRgb(this.baseRgb, this.activeRgb, eased));
      ctx.beginPath();
      ctx.arc(dot.x + dot.ox, dot.y + dot.oy, radius * (1 + eased * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private buildGrid(): void {
    if (!this.ctx) return;

    const gap = Math.max(this.gap(), 2);
    const cols = Math.ceil(this.viewWidth / gap) + 1;
    const rows = Math.ceil(this.viewHeight / gap) + 1;

    // Centre the grid so it stays symmetric at any size.
    const offsetX = (this.viewWidth - (cols - 1) * gap) / 2;
    const offsetY = (this.viewHeight - (rows - 1) * gap) / 2;

    const dots: Dot[] = new Array(cols * rows);
    let i = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        dots[i++] = {
          x: offsetX + col * gap,
          y: offsetY + row * gap,
          ox: 0,
          oy: 0,
          vx: 0,
          vy: 0,
        };
      }
    }
    this.dots = dots;
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    const shockRadius = this.shockRadius();
    if (shockRadius <= 0) return;

    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;
    const strength = this.shockStrength();

    for (const dot of this.dots) {
      const dx = dot.x + dot.ox - cx;
      const dy = dot.y + dot.oy - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > shockRadius) continue;

      const falloff = 1 - dist / shockRadius;
      const impulse = strength * falloff * falloff;
      const nx = dist > 0.001 ? dx / dist : Math.random() - 0.5;
      const ny = dist > 0.001 ? dy / dist : Math.random() - 0.5;
      dot.vx += nx * impulse;
      dot.vy += ny * impulse;
    }
  };
}
