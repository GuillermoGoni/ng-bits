import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  input,
  numberAttribute,
} from '@angular/core';

import { NGB_BACKGROUND_STYLES } from '../../core/background-base';
import { toRgb, toRgbList } from '../../core/color';
import { NgbOglBackgroundBase, NgbUniforms } from '../../core/ogl-background-base';
import {
  NGB_CHUNK_COLOR,
  NGB_CHUNK_DITHER,
  NGB_CHUNK_NOISE2,
  NGB_CHUNK_NOISE3,
  NGB_CHUNK_UV,
} from '../../core/shader-chunks';

/** Direction the fluid churns towards. */
export type NgbFlowDirection = 'down' | 'up' | 'left' | 'right';

const FLOW: Record<NgbFlowDirection, [number, number]> = {
  down: [0, 1],
  up: [0, -1],
  left: [1, 0],
  right: [-1, 0],
};

const FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uMouseStrength;
uniform float uMouseRadius;
uniform vec2 uFlow;
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform int uStopCount;
uniform vec3 uBackground;
uniform float uBackgroundAlpha;
uniform float uSpeed;
uniform float uScale;
uniform float uTurbulence;
uniform float uFluidity;
uniform float uRimWidth;
uniform float uSharpness;
uniform float uShimmer;
uniform float uGlow;
uniform float uBands;

varying vec2 vUv;

${NGB_CHUNK_UV}
${NGB_CHUNK_NOISE2}
${NGB_CHUNK_NOISE3}
${NGB_CHUNK_COLOR}
${NGB_CHUNK_DITHER}

// Polynomial smooth-min — how readily the two layers fuse into one body.
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / max(k, 0.0001), 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = vec2((vUv.x - 0.5) * aspect, vUv.y - 0.5) * (2.0 / max(uScale, 0.001));

  float t = uTime * uSpeed;
  vec2 drift = uFlow * t * 0.25;

  // Domain warp: this is what turns smooth noise into churning liquid.
  vec2 warp = vec2(
    ngbFbm3(vec3(p * 0.8 + drift, t * 0.18), 3),
    ngbFbm3(vec3(p * 0.8 + drift + 4.7, t * 0.21), 3)
  ) * uTurbulence;

  // Two independent bodies of fluid, fused by the smooth-min. Kept to three
  // low octaves: a fourth adds detail the contours turn into visual noise.
  float layerA = ngbFbm3(vec3(p * 0.55 + warp * 0.5 + drift, t * 0.25), 3);
  float layerB = ngbFbm3(vec3(p * 0.7 + warp * 0.4 - drift * 0.8 + 9.1, t * 0.19), 3);
  float field = smin(layerA, layerB, uFluidity);

  // The pointer raises a magnetic spike, bunching the contours around it.
  if (uMouseStrength > 0.0) {
    vec2 m = vec2((uMouse.x - 0.5) * aspect, uMouse.y - 0.5) * (2.0 / max(uScale, 0.001));
    float d = length(p - m) / max(uMouseRadius * (2.0 / max(uScale, 0.001)), 0.0001);
    field += exp(-d * d) * uMouseStrength * 0.6;
  }

  // Iso-contours of the field: the glowing rims tracing the surface.
  float bands = field * uBands;
  float toLine = abs(fract(bands) - 0.5) * 2.0;
  float rim = 1.0 - smoothstep(0.0, max(uRimWidth, 0.001), toLine);
  rim = pow(rim, max(uSharpness, 0.05));

  // Fine grainy break-up along the rims.
  if (uShimmer > 0.0) {
    float grain = ngbNoise(p * 90.0 + t * 2.0) * 0.5 + 0.5;
    rim *= mix(1.0, grain, clamp(uShimmer * 0.5, 0.0, 1.0));
  }

  rim *= uGlow;

  // Colours are spread across the body by height.
  vec3 tint = ngbRamp(uColor0, uColor1, uColor2, uColor3, uStopCount, vUv.y);

  vec3 color = uBackground * uBackgroundAlpha + tint * rim;
  color += ngbDither(gl_FragCoord.xy) / 255.0;

  float alpha = clamp(uBackgroundAlpha + rim, 0.0, 1.0);
  gl_FragColor = vec4(color, alpha);
}
`;

/**
 * Magnetic fluid rendered as glowing iso-contours: two domain-warped bodies
 * fused by a smooth-min, traced by bright rims that bunch up under the
 * pointer like a spike pulled out by a magnet.
 *
 * ```html
 * <ngb-ferrofluid class="absolute inset-0 -z-10" [colors]="['#ffffff']" mouseInteraction />
 * ```
 */
@Component({
  selector: 'ngb-ferrofluid',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbFerrofluid extends NgbOglBackgroundBase {
  /** Up to four rim colours, spread across the body by height. */
  readonly colors = input<readonly string[]>(['#ffffff']);
  /** Background painted behind the fluid. Empty string leaves it transparent. */
  readonly backgroundColor = input('#000000');
  /** How fast the fluid churns. */
  readonly speed = input(0.5, { transform: numberAttribute });
  /** Feature size. Higher zooms in for larger, fewer blobs. */
  readonly scale = input(1.6, { transform: numberAttribute });
  /** Domain distortion — higher is more chaotic and swirling. */
  readonly turbulence = input(1, { transform: numberAttribute });
  /** Softness of the merge between the two layers. Higher is more liquid. */
  readonly fluidity = input(0.1, { transform: numberAttribute });
  /** Thickness of the glowing contour lines. */
  readonly rimWidth = input(0.2, { transform: numberAttribute });
  /** Contrast of the rims. Higher gives crisper, thinner edges. */
  readonly sharpness = input(2.5, { transform: numberAttribute });
  /** Grainy break-up along the rims. 0 keeps them smooth. */
  readonly shimmer = input(1.5, { transform: numberAttribute });
  /** Overall rim brightness. */
  readonly glow = input(2, { transform: numberAttribute });
  /** Number of contour lines across the field's range. */
  readonly bands = input(4, { transform: numberAttribute });
  /** Direction the fluid flows towards. */
  readonly flowDirection = input<NgbFlowDirection>('down');
  /** Raise a magnetic spike under the pointer. */
  readonly mouseInteraction = input(false, { transform: booleanAttribute });
  /** Intensity of the magnetic spike. */
  readonly mouseStrength = input(1, { transform: numberAttribute });
  /** Falloff radius of the spike, in element-height units. */
  readonly mouseRadius = input(0.35, { transform: numberAttribute });

  protected override trackPointer = true;
  protected override pointerSmoothing = 0.09;
  protected readonly fragment = FRAGMENT;

  protected buildUniforms(): NgbUniforms {
    return {
      uMouse: { value: [0.5, 0.5] },
      uMouseStrength: { value: 0 },
      uMouseRadius: { value: 0.35 },
      uFlow: { value: [0, 1] },
      uColor0: { value: [1, 1, 1] },
      uColor1: { value: [1, 1, 1] },
      uColor2: { value: [1, 1, 1] },
      uColor3: { value: [1, 1, 1] },
      uStopCount: { value: 2 },
      uBackground: { value: [0, 0, 0] },
      uBackgroundAlpha: { value: 1 },
      uSpeed: { value: 0.5 },
      uScale: { value: 1.6 },
      uTurbulence: { value: 1 },
      uFluidity: { value: 0.1 },
      uRimWidth: { value: 0.2 },
      uSharpness: { value: 2.5 },
      uShimmer: { value: 1.5 },
      uGlow: { value: 2 },
      uBands: { value: 4 },
    };
  }

  protected override syncUniforms(): void {
    const requested = this.colors();
    const [c0, c1, c2, c3] = toRgbList(requested, 4);
    this.setUniform('uColor0', c0);
    this.setUniform('uColor1', c1);
    this.setUniform('uColor2', c2);
    this.setUniform('uColor3', c3);
    // A single colour must not run through the ramp, or it would interpolate
    // towards itself and lose the flat tint the caller asked for.
    this.setUniform('uStopCount', Math.max(2, Math.min(4, requested.length)));

    const background = this.backgroundColor();
    this.setUniform('uBackground', toRgb(background, [0, 0, 0]));
    this.setUniform('uBackgroundAlpha', background ? 1 : 0);

    this.setUniform('uFlow', FLOW[this.flowDirection()] ?? FLOW.down);
    this.setUniform('uSpeed', this.speed());
    this.setUniform('uScale', this.scale());
    this.setUniform('uTurbulence', this.turbulence());
    this.setUniform('uFluidity', this.fluidity());
    this.setUniform('uRimWidth', this.rimWidth());
    this.setUniform('uSharpness', this.sharpness());
    this.setUniform('uShimmer', this.shimmer());
    this.setUniform('uGlow', this.glow());
    this.setUniform('uBands', this.bands());
    this.setUniform('uMouseRadius', this.mouseRadius());
    this.setUniform('uMouseStrength', this.mouseInteraction() ? this.mouseStrength() : 0);
  }

  protected override update(): void {
    if (!this.mouseInteraction()) return;
    this.setUniform('uMouse', [this.pointer.sx, 1 - this.pointer.sy]);
  }
}
