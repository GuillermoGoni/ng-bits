import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  input,
  numberAttribute,
} from '@angular/core';

import { NGB_BACKGROUND_STYLES } from '../../core/background-base';
import { toRgb } from '../../core/color';
import { NgbOglBackgroundBase, NgbUniforms } from '../../core/ogl-background-base';
import { NGB_CHUNK_NOISE2, NGB_CHUNK_NOISE3, NGB_CHUNK_UV } from '../../core/shader-chunks';

/** Glyph stamped into a lit cell. */
export type NgbPixelVariant = 'square' | 'circle' | 'triangle' | 'diamond';

const VARIANTS: Record<NgbPixelVariant, number> = {
  square: 0,
  circle: 1,
  triangle: 2,
  diamond: 3,
};

const MAX_RIPPLES = 12;

const FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform vec3 uColor;
uniform vec3 uBackground;
uniform float uBackgroundAlpha;
uniform float uPixelSize;
uniform float uPatternScale;
uniform float uPatternDensity;
uniform float uJitter;
uniform float uSpeed;
uniform float uEdgeFade;
uniform float uNoiseAmount;
uniform int uVariant;

uniform vec3 uRipples[${MAX_RIPPLES}];
uniform int uRippleCount;
uniform float uRippleSpeed;
uniform float uRippleThickness;
uniform float uRippleIntensity;

uniform float uLiquidStrength;
uniform float uLiquidRadius;
uniform float uLiquidWobble;

varying vec2 vUv;

${NGB_CHUNK_UV}
${NGB_CHUNK_NOISE2}
${NGB_CHUNK_NOISE3}

// Bayer 8x8 ordered dither, built by nesting the 2x2 kernel twice. This is
// what makes the field resolve into crisp on/off pixels instead of a blur.
float bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x / 2.0 + a.y * a.y * 0.75);
}

float bayer4(vec2 a) {
  return bayer2(0.5 * a) * 0.25 + bayer2(a);
}

float bayer8(vec2 a) {
  return bayer4(0.5 * a) * 0.25 + bayer2(a);
}

float cellHash(vec2 c) {
  return fract(sin(dot(floor(c), vec2(12.9898, 78.233))) * 43758.5453);
}

// Coverage of the glyph at this fragment, in the cell's -1..1 local space.
float glyph(vec2 local) {
  if (uVariant == 1) return step(length(local), 0.92);
  if (uVariant == 2) {
    vec2 p = vec2(local.x, local.y * 0.5 + 0.5);
    return step(abs(p.x) * 1.1 + (1.0 - p.y), 1.0);
  }
  if (uVariant == 3) return step(abs(local.x) + abs(local.y), 1.0);
  return 1.0;
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 frag = gl_FragCoord.xy;

  float cellSize = max(uPixelSize, 2.0);
  vec2 cell = floor(frag / cellSize);
  vec2 cellCentre = (cell + 0.5) * cellSize;
  vec2 cellUv = cellCentre / uResolution;

  float t = uTime * uSpeed;

  vec2 samplePos = (cellUv - 0.5) * vec2(aspect, 1.0) * uPatternScale;

  // Liquid mode drags the sampling grid around the pointer with a wobble.
  if (uLiquidStrength > 0.0) {
    vec2 delta = (cellUv - uMouse) * vec2(aspect, 1.0);
    float r = length(delta) / max(uLiquidRadius, 0.001);
    float pull = exp(-r * r);
    float wobble = 0.55 + 0.45 * sin(uTime * uLiquidWobble + r * 6.2831);
    samplePos += normalize(delta + vec2(0.0001)) * pull * wobble * uLiquidStrength;
  }

  // The organic field the dither resolves against.
  float value = ngbFbm3(vec3(samplePos * 3.0, t * 0.5), 4) * 0.5 + 0.5;
  float coverage = value * uPatternDensity;

  // Expanding rings from each recorded click.
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    if (i >= uRippleCount) break;
    vec3 ripple = uRipples[i];
    float age = uTime - ripple.z;
    if (age < 0.0) continue;

    float d = length((cellUv - ripple.xy) * vec2(aspect, 1.0));
    float radius = age * uRippleSpeed;
    float ring = exp(-pow((d - radius) / max(uRippleThickness, 0.001), 2.0));
    coverage += ring * uRippleIntensity * exp(-age * 1.1);
  }

  // Per-cell jitter breaks up the regularity of the dither pattern.
  if (uJitter > 0.0) coverage += (cellHash(cell) - 0.5) * uJitter;

  float lit = step(bayer8(cell), coverage);

  vec2 local = (frag - cellCentre) / (cellSize * 0.5);
  float alpha = lit * glyph(local);

  if (uEdgeFade > 0.0) {
    vec2 e = smoothstep(vec2(0.0), vec2(uEdgeFade), vUv)
           * smoothstep(vec2(0.0), vec2(uEdgeFade), 1.0 - vUv);
    alpha *= e.x * e.y;
  }

  vec3 color = mix(uBackground * uBackgroundAlpha, uColor, alpha);
  if (uNoiseAmount > 0.0) {
    color += (ngbNoise(frag * 1.3 + uTime * 30.0)) * uNoiseAmount * 0.1;
  }

  float outAlpha = clamp(uBackgroundAlpha + alpha, 0.0, 1.0);
  gl_FragColor = vec4(color, outAlpha);
}
`;

/**
 * A dithered pixel field. An organic noise field is resolved through an 8x8
 * Bayer matrix, so every cell is fully on or fully off — the crisp retro look,
 * rather than a grid of smoothly shrinking dots.
 *
 * The sibling {@link NgbPixelBlast} keeps the softer size-modulated variant.
 *
 * ```html
 * <ngb-pixel class="absolute inset-0 -z-10" variant="circle" color="#B497CF" [pixelSize]="4" />
 * ```
 */
@Component({
  selector: 'ngb-pixel',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbPixel extends NgbOglBackgroundBase {
  /** Glyph stamped into a lit cell. */
  readonly variant = input<NgbPixelVariant>('square');
  /** Pixel colour. */
  readonly color = input('#B497CF');
  /** Background behind the pixels. Ignored when `transparent` is set. */
  readonly backgroundColor = input('#000000');
  /** Render without a background so the page shows through. */
  readonly transparent = input(false, { transform: booleanAttribute });
  /** Cell size in CSS pixels; scaled by the device pixel ratio for you. */
  readonly pixelSize = input(4, { transform: numberAttribute });
  /** Noise scale. Higher means smaller, busier clusters. */
  readonly patternScale = input(2, { transform: numberAttribute });
  /** Density multiplier applied to the coverage field. */
  readonly patternDensity = input(1, { transform: numberAttribute });
  /** Random jitter added to per-cell coverage, 0..1. */
  readonly pixelSizeJitter = input(0, { transform: numberAttribute });
  /** Animation time scale. */
  readonly speed = input(0.5, { transform: numberAttribute });
  /** Width of the soft border, 0..0.5 of the element. */
  readonly edgeFade = input(0.25, { transform: numberAttribute });
  /** Grain added after the dither, 0..1. */
  readonly noiseAmount = input(0, { transform: numberAttribute });
  /** Emit a ring on pointer down. */
  readonly enableRipples = input(true, { transform: booleanAttribute });
  /** Ring expansion speed, in element widths per second. */
  readonly rippleSpeed = input(0.5, { transform: numberAttribute });
  /** Ring thickness. */
  readonly rippleThickness = input(0.08, { transform: numberAttribute });
  /** How strongly a ring lights the cells it crosses. */
  readonly rippleIntensityScale = input(1, { transform: numberAttribute });
  /** Drag the pattern around under the pointer. */
  readonly liquid = input(false, { transform: booleanAttribute });
  /** Distortion strength used by `liquid`. */
  readonly liquidStrength = input(0.35, { transform: numberAttribute });
  /** Radius of the liquid brush, in element widths. */
  readonly liquidRadius = input(0.3, { transform: numberAttribute });
  /** Wobble frequency of the liquid distortion. */
  readonly liquidWobbleSpeed = input(3, { transform: numberAttribute });

  protected override trackPointer = true;
  protected override pointerSmoothing = 0.12;
  protected readonly fragment = FRAGMENT;

  /** Flat [x, y, startTime] triples; the buffer wraps once it is full. */
  private readonly ripples: number[] = new Array(MAX_RIPPLES * 3).fill(0);
  private rippleCount = 0;
  private rippleCursor = 0;

  protected override setup(canvas: HTMLCanvasElement): void {
    super.setup(canvas);
    this.hostRef.nativeElement.addEventListener('pointerdown', this.handlePointerDown);
  }

  protected override teardown(): void {
    this.hostRef.nativeElement.removeEventListener('pointerdown', this.handlePointerDown);
    super.teardown();
  }

  protected buildUniforms(): NgbUniforms {
    return {
      uMouse: { value: [0.5, 0.5] },
      uColor: { value: [0.71, 0.59, 0.94] },
      uBackground: { value: [0, 0, 0] },
      uBackgroundAlpha: { value: 1 },
      uPixelSize: { value: 4 },
      uPatternScale: { value: 2 },
      uPatternDensity: { value: 1 },
      uJitter: { value: 0 },
      uSpeed: { value: 0.5 },
      uEdgeFade: { value: 0.25 },
      uNoiseAmount: { value: 0 },
      uVariant: { value: 0 },
      uRipples: { value: this.ripples },
      uRippleCount: { value: 0 },
      uRippleSpeed: { value: 0.5 },
      uRippleThickness: { value: 0.08 },
      uRippleIntensity: { value: 1 },
      uLiquidStrength: { value: 0 },
      uLiquidRadius: { value: 0.3 },
      uLiquidWobble: { value: 3 },
    };
  }

  protected override syncUniforms(): void {
    this.setUniform('uVariant', VARIANTS[this.variant()] ?? 0);
    this.setUniform('uColor', toRgb(this.color(), [0.71, 0.59, 0.94]));
    this.setUniform('uBackground', toRgb(this.backgroundColor(), [0, 0, 0]));
    this.setUniform('uBackgroundAlpha', this.transparent() ? 0 : 1);
    this.setUniform('uPixelSize', this.pixelSize() * this.pixelRatio);
    this.setUniform('uPatternScale', this.patternScale());
    this.setUniform('uPatternDensity', this.patternDensity());
    this.setUniform('uJitter', this.pixelSizeJitter());
    this.setUniform('uSpeed', this.speed());
    this.setUniform('uEdgeFade', this.edgeFade());
    this.setUniform('uNoiseAmount', this.noiseAmount());
    this.setUniform('uRippleSpeed', this.rippleSpeed());
    this.setUniform('uRippleThickness', this.rippleThickness());
    this.setUniform('uRippleIntensity', this.rippleIntensityScale());
    this.setUniform('uLiquidStrength', this.liquid() ? this.liquidStrength() : 0);
    this.setUniform('uLiquidRadius', this.liquidRadius());
    this.setUniform('uLiquidWobble', this.liquidWobbleSpeed());
  }

  protected override onResize(width: number, height: number, dpr: number): void {
    super.onResize(width, height, dpr);
    // Cell size is authored in CSS pixels, so it has to track the DPR.
    this.setUniform('uPixelSize', this.pixelSize() * dpr);
  }

  protected override update(): void {
    if (!this.liquid()) return;
    this.setUniform('uMouse', [this.pointer.sx, 1 - this.pointer.sy]);
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.enableRipples()) return;

    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const slot = this.rippleCursor * 3;
    this.ripples[slot] = (event.clientX - rect.left) / rect.width;
    this.ripples[slot + 1] = 1 - (event.clientY - rect.top) / rect.height;
    this.ripples[slot + 2] = this.time;

    this.rippleCursor = (this.rippleCursor + 1) % MAX_RIPPLES;
    this.rippleCount = Math.min(this.rippleCount + 1, MAX_RIPPLES);
    this.setUniform('uRippleCount', this.rippleCount);
  };
}
