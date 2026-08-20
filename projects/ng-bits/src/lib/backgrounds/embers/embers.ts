import { ChangeDetectionStrategy, Component, effect, input, numberAttribute } from '@angular/core';

import { NGB_BACKGROUND_STYLES, NgbBackgroundBase } from '../../core/background-base';
import { Rgb, mixRgb, rgbToCss, toRgb } from '../../core/color';

const DEFAULT_COLORS = ['#ffb15c', '#ff6b2c', '#ffe1a8'] as const;
const WHITE: Rgb = [1, 1, 1];

interface EmberSeed {
  /** Normalised age at t=0, so the first frame already fills the field. */
  offset: number;
  /** Horizontal origin within the configured source spread. */
  origin: number;
  /** Per-particle ascent multiplier. */
  velocity: number;
  /** Per-particle radius multiplier. */
  size: number;
  /** Stable phase for flicker and lateral turbulence. */
  phase: number;
  /** Controls the amount of lateral drift. */
  sway: number;
  /** Stable palette selector in the 0..1 range. */
  palette: number;
  /** A few particles receive a brighter core. */
  brightness: number;
}

function fract(value: number): number {
  return value - Math.floor(value);
}

/** Deterministic pseudo-random value, so input changes never make the field jump. */
function hash(index: number, salt: number): number {
  return fract(Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Small glowing sparks that rise from the lower edge, flicker, and bend with
 * wind and turbulence. Canvas 2D keeps the layer light enough to compose over
 * another background without opening a second WebGL context.
 *
 * ```html
 * <ngb-embers
 *   class="absolute inset-0 -z-10"
 *   [colors]="['#ffb15c', '#ff6b2c', '#ffe1a8']"
 *   [count]="90"
 * />
 * ```
 */
@Component({
  selector: 'ngb-embers',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbEmbers extends NgbBackgroundBase {
  /** Spark palette. Invalid colours fall back to the default warm palette. */
  readonly colors = input<readonly string[]>(DEFAULT_COLORS);
  /** Number of live sparks. Clamped to 0..500. */
  readonly count = input(90, { transform: numberAttribute });
  /** Ascent and flicker speed. */
  readonly speed = input(1, { transform: numberAttribute });
  /** Base spark width in CSS pixels. */
  readonly size = input(1.6, { transform: numberAttribute });
  /** Strength of the additive halo around each spark. */
  readonly glow = input(1.2, { transform: numberAttribute });
  /** Amount of irregular horizontal movement. */
  readonly turbulence = input(0.8, { transform: numberAttribute });
  /** Horizontal drift; negative values blow left and positive values blow right. */
  readonly wind = input(0.15, { transform: numberAttribute });
  /** Width of the source along the bottom edge, from 0 (centre) to 1 (full width). */
  readonly spread = input(0.8, { transform: numberAttribute });
  /** Layer opacity, 0..1. */
  readonly opacity = input(0.9, { transform: numberAttribute });

  private ctx!: CanvasRenderingContext2D;
  private embers: EmberSeed[] = [];
  private palette: Rgb[] = DEFAULT_COLORS.map((color) => toRgb(color));
  private paletteCss: string[] = this.palette.map((color) => rgbToCss(color));
  private coreCss: string[] = this.palette.map((color) => rgbToCss(mixRgb(color, WHITE, 0.58)));

  constructor() {
    super();

    effect(() => {
      const colors = this.colors();
      const source = colors.length ? colors : DEFAULT_COLORS;
      this.palette = source.map((color, index) =>
        toRgb(color, toRgb(DEFAULT_COLORS[index % DEFAULT_COLORS.length])),
      );
      this.paletteCss = this.palette.map((color) => rgbToCss(color));
      this.coreCss = this.palette.map((color) => rgbToCss(mixRgb(color, WHITE, 0.58)));
      this.requestFrame();
    });

    effect(() => {
      this.count();
      this.buildEmbers();
      this.requestFrame();
    });
  }

  protected setup(canvas: HTMLCanvasElement): void {
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    this.buildEmbers();
  }

  protected teardown(): void {
    this.embers = [];
  }

  protected onResize(): void {
    // Positions are calculated in normalised space, so no layout rebuild is needed.
  }

  protected frame(time: number, _delta: number): void {
    if (!this.ctx) return;

    const ctx = this.ctx;
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, this.viewWidth, this.viewHeight);
    if (!this.embers.length) return;

    const speed = Math.max(0, this.speed());
    const baseSize = Math.max(0, this.size());
    const glow = Math.max(0, this.glow());
    const turbulence = Math.max(0, this.turbulence());
    const wind = this.wind();
    const spread = Math.max(0, Math.min(1, this.spread()));
    const opacity = Math.max(0, Math.min(1, this.opacity()));
    if (baseSize === 0 || opacity === 0) return;

    const width = this.viewWidth;
    const height = this.viewHeight;
    const travel = height + 48;
    const clock = time * speed;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    for (const ember of this.embers) {
      const ascent = (44 + ember.velocity * 76) / Math.max(height, 1);
      const progress = fract(ember.offset + clock * ascent);
      const particleSize = Math.max(0.3, baseSize * ember.size * (1 - progress * 0.48));

      const sourceX = width * (0.5 + (ember.origin - 0.5) * spread);
      const windOffset = wind * progress * height * 0.18;
      const swayAmplitude = (7 + ember.sway * 21) * turbulence;
      const sway =
        Math.sin(
          progress * (5.5 + ember.sway * 4) + clock * (0.65 + ember.velocity * 0.45) + ember.phase,
        ) * swayAmplitude;

      const x = sourceX + windOffset + sway;
      const y = height + 18 - progress * travel;
      const fadeIn = smoothstep(0, 0.045, progress);
      const fadeOut = 1 - smoothstep(0.7, 1, progress);
      const flicker =
        0.62 +
        0.38 * Math.pow(0.5 + 0.5 * Math.sin(clock * (8 + ember.brightness * 8) + ember.phase), 2);
      const alpha = opacity * fadeIn * fadeOut * flicker;
      if (alpha < 0.005) continue;

      const paletteIndex = Math.min(
        this.palette.length - 1,
        Math.floor(ember.palette * this.palette.length),
      );
      const trail = particleSize * (1.8 + speed * 2.8) * (0.8 + ember.velocity * 0.5);
      const trailX = wind * trail * 0.45 + Math.cos(ember.phase + progress * 8) * turbulence;

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = this.paletteCss[paletteIndex];
      ctx.shadowColor = this.paletteCss[paletteIndex];
      ctx.shadowBlur = particleSize * glow * 4;
      ctx.lineWidth = particleSize;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - trailX, y + trail);
      ctx.stroke();

      if (ember.brightness > 0.72) {
        ctx.globalAlpha = alpha * 0.72;
        ctx.fillStyle = this.coreCss[paletteIndex];
        ctx.beginPath();
        ctx.arc(x, y, particleSize * 0.38, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private buildEmbers(): void {
    const count = Math.max(0, Math.min(500, Math.round(this.count())));
    this.embers = Array.from({ length: count }, (_, index) => ({
      offset: hash(index, 1),
      origin: hash(index, 2),
      velocity: hash(index, 3),
      size: 0.55 + hash(index, 4) * 1.15,
      phase: hash(index, 5) * Math.PI * 2,
      sway: hash(index, 6),
      palette: hash(index, 7),
      brightness: hash(index, 8),
    }));
  }
}
