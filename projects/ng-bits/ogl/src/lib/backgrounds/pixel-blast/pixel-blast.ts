import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  input,
  numberAttribute,
} from '@angular/core';

import { NGB_BACKGROUND_STYLES } from '@guillermogoni/ng-bits';
import { toRgb } from '@guillermogoni/ng-bits';
import { NgbOglBackgroundBase, NgbUniforms } from '../../core/ogl-background-base';
import { NGB_CHUNK_NOISE3, NGB_CHUNK_UV } from '@guillermogoni/ng-bits';

/** Glyph stamped into each pixel cell. */
export type NgbPixelShape = 'square' | 'circle' | 'triangle' | 'diamond';

const SHAPES: Record<NgbPixelShape, number> = { square: 0, circle: 1, triangle: 2, diamond: 3 };
const MAX_RIPPLES = 12;

const FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColor;
uniform float uPixelSize;
uniform float uSpeed;
uniform float uDensity;
uniform float uThreshold;
uniform float uEdgeFade;
uniform int uShape;

uniform vec3 uRipples[${MAX_RIPPLES}];
uniform int uRippleCount;
uniform float uRippleSpeed;
uniform float uRippleWidth;
uniform float uRippleStrength;
uniform float uRippleDecay;

varying vec2 vUv;

${NGB_CHUNK_UV}
${NGB_CHUNK_NOISE3}

// Coverage of the cell glyph at the given fill amount, in -1..1 local space.
float shapeMask(vec2 local, float amount) {
  float size = amount;
  if (uShape == 1) return step(length(local), size);
  if (uShape == 2) {
    // Upright triangle inscribed in the cell.
    vec2 p = vec2(local.x, local.y * 0.5 + 0.5);
    float edge = abs(p.x) * 1.15 + (1.0 - p.y);
    return step(edge, size);
  }
  if (uShape == 3) return step(abs(local.x) + abs(local.y), size * 1.4);
  return step(max(abs(local.x), abs(local.y)), size);
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 frag = gl_FragCoord.xy;

  float cellSize = max(uPixelSize, 2.0);
  vec2 cellId = floor(frag / cellSize);
  vec2 cellCentre = (cellId + 0.5) * cellSize;
  vec2 cellUv = cellCentre / uResolution;

  float t = uTime * uSpeed;

  // Base field: drifting 3D noise sampled once per cell, so it stays blocky.
  vec2 field = vec2(cellUv.x * aspect, cellUv.y) * uDensity;
  float value = ngbFbm3(vec3(field, t * 0.35), 3) * 0.5 + 0.5;

  // Expanding rings from each recorded impact.
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    if (i >= uRippleCount) break;
    vec3 ripple = uRipples[i];
    float age = uTime - ripple.z;
    if (age < 0.0) continue;

    vec2 delta = (cellUv - ripple.xy) * vec2(aspect, 1.0);
    float d = length(delta);
    float radius = age * uRippleSpeed;
    float ring = exp(-pow((d - radius) / max(uRippleWidth, 0.001), 2.0));
    value += ring * uRippleStrength * exp(-age * uRippleDecay);
  }

  // Ramp relative to the threshold, so raising it thins the field out
  // instead of extinguishing it.
  float amount = smoothstep(uThreshold, uThreshold + 0.4, value);

  vec2 local = (frag - cellCentre) / (cellSize * 0.5);
  float mask = shapeMask(local, amount);

  // Soften the outer border so the grid does not end on a hard edge.
  float fade = 1.0;
  if (uEdgeFade > 0.0) {
    vec2 e = smoothstep(vec2(0.0), vec2(uEdgeFade), vUv)
           * smoothstep(vec2(0.0), vec2(uEdgeFade), 1.0 - vUv);
    fade = e.x * e.y;
  }

  float alpha = mask * fade;
  gl_FragColor = vec4(uColor * alpha, alpha);
}
`;

/**
 * A grid of pixel glyphs driven by drifting noise, with rings that blast
 * outwards from every click. `shape` picks the glyph.
 *
 * ```html
 * <ngb-pixel-blast class="absolute inset-0 -z-10" shape="circle" color="#b19eef" [pixelSize]="6" />
 * ```
 */
@Component({
  selector: 'ngb-pixel-blast',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbPixelBlast extends NgbOglBackgroundBase {
  /** Glyph stamped in every cell. */
  readonly shape = input<NgbPixelShape>('square');
  /** Glyph colour. */
  readonly color = input('#b19eef');
  /** Cell size in device pixels. */
  readonly pixelSize = input(6, { transform: numberAttribute });
  /** Noise drift speed. */
  readonly speed = input(1, { transform: numberAttribute });
  /** Noise frequency — higher means smaller clusters. */
  readonly density = input(3, { transform: numberAttribute });
  /** Cut-off below which cells stay empty, 0..1. Higher is sparser. */
  readonly threshold = input(0.3, { transform: numberAttribute });
  /** Width of the soft border, 0..0.5 of the element. */
  readonly edgeFade = input(0.1, { transform: numberAttribute });
  /** Emit a ring on pointer down. */
  readonly rippleOnClick = input(true, { transform: booleanAttribute });
  /** Ring expansion speed, in element widths per second. */
  readonly rippleSpeed = input(0.6, { transform: numberAttribute });
  /** Ring thickness. */
  readonly rippleWidth = input(0.06, { transform: numberAttribute });
  /** How strongly a ring lights up the cells it crosses. */
  readonly rippleStrength = input(0.9, { transform: numberAttribute });
  /** How quickly a ring fades, per second. */
  readonly rippleDecay = input(1.2, { transform: numberAttribute });

  protected readonly fragment = FRAGMENT;

  /** Flat [x, y, startTime] triples; index 0 is the oldest live ripple. */
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
      uColor: { value: [0.69, 0.62, 0.94] },
      uPixelSize: { value: 6 },
      uSpeed: { value: 1 },
      uDensity: { value: 3 },
      uThreshold: { value: 0.45 },
      uEdgeFade: { value: 0.1 },
      uShape: { value: 0 },
      uRipples: { value: this.ripples },
      uRippleCount: { value: 0 },
      uRippleSpeed: { value: 0.6 },
      uRippleWidth: { value: 0.06 },
      uRippleStrength: { value: 0.9 },
      uRippleDecay: { value: 1.2 },
    };
  }

  protected override syncUniforms(): void {
    this.setUniform('uShape', SHAPES[this.shape()] ?? 0);
    this.setUniform('uColor', toRgb(this.color(), [0.69, 0.62, 0.94]));
    this.setUniform('uPixelSize', this.pixelSize() * this.pixelRatio);
    this.setUniform('uSpeed', this.speed());
    this.setUniform('uDensity', this.density());
    this.setUniform('uThreshold', this.threshold());
    this.setUniform('uEdgeFade', this.edgeFade());
    this.setUniform('uRippleSpeed', this.rippleSpeed());
    this.setUniform('uRippleWidth', this.rippleWidth());
    this.setUniform('uRippleStrength', this.rippleStrength());
    this.setUniform('uRippleDecay', this.rippleDecay());
  }

  protected override onResize(width: number, height: number, dpr: number): void {
    super.onResize(width, height, dpr);
    // Cell size is expressed in CSS pixels, so it has to track the DPR.
    this.setUniform('uPixelSize', this.pixelSize() * dpr);
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.rippleOnClick()) return;

    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    // Ring buffer: the oldest ripple is overwritten once we hit the cap.
    const slot = this.rippleCursor * 3;
    this.ripples[slot] = (event.clientX - rect.left) / rect.width;
    this.ripples[slot + 1] = 1 - (event.clientY - rect.top) / rect.height;
    this.ripples[slot + 2] = this.time;

    this.rippleCursor = (this.rippleCursor + 1) % MAX_RIPPLES;
    this.rippleCount = Math.min(this.rippleCount + 1, MAX_RIPPLES);
    this.setUniform('uRippleCount', this.rippleCount);
  };
}
