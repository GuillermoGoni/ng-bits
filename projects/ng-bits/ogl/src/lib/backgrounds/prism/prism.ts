import { ChangeDetectionStrategy, Component, input, numberAttribute } from '@angular/core';

import { NGB_BACKGROUND_STYLES } from '@guillermogoni/ng-bits';
import { toRgb, toRgbList } from '@guillermogoni/ng-bits';
import { NgbOglBackgroundBase, NgbUniforms } from '../../core/ogl-background-base';
import {
  NGB_CHUNK_COLOR,
  NGB_CHUNK_DITHER,
  NGB_CHUNK_NOISE2,
  NGB_CHUNK_UV,
} from '@guillermogoni/ng-bits';

/** Motion treatment for the prismatic light. */
export type NgbPrismAnimation = 'drift' | 'hover' | 'still' | 'rotate' | '3drotate';

const FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform vec2 uOffset;
uniform vec3 uBackground;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uScale;
uniform float uIntensity;
uniform float uGlow;
uniform float uBloom;
uniform float uHueShift;
uniform float uDispersion;
uniform float uNoise;

varying vec2 vUv;

${NGB_CHUNK_UV}
${NGB_CHUNK_COLOR}
${NGB_CHUNK_DITHER}
${NGB_CHUNK_NOISE2}

float ellipse(vec2 p, vec2 centre, vec2 radius) {
  vec2 d = (p - centre) / radius;
  return exp(-dot(d, d) * 2.2);
}

vec3 palette(float t) {
  t = clamp(t, 0.0, 1.0);
  return t < 0.5
    ? mix(uColorA, uColorB, t * 2.0)
    : mix(uColorB, uColorC, (t - 0.5) * 2.0);
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  float time = uTime * 0.22;

  vec2 p = vUv - 0.5 - uOffset;
  p.x *= aspect;
  p /= max(uScale, 0.001);

  // Pointer motion only nudges the light; it never turns the composition into
  // a literal 3D object. This keeps the hero copy above it legible.
  vec2 cursor = (uPointer - 0.5) * vec2(0.18, 0.10);
  vec2 drift = vec2(sin(time), cos(time * 0.83)) * 0.035;

  float cyanWash = ellipse(p, vec2(-0.43, -0.02) + drift + cursor, vec2(0.78, 0.54));
  float violetWash = ellipse(
    p,
    vec2(0.06 + sin(time * 0.71) * 0.05, 0.03) - cursor * 0.45,
    vec2(0.72, 0.50)
  );
  float coralWash = ellipse(
    p,
    vec2(0.50, -0.12 + cos(time * 0.66) * 0.035),
    vec2(0.62, 0.48)
  );

  // A soft, tilted caustic is the signature of the effect. The broad halo,
  // tight white core and slight colour splitting are layered independently so
  // the control inputs are meaningful rather than just a tint over a shape.
  float horizon = -0.29 + p.x * 0.045 + sin(p.x * 3.2 + time * 1.7) * 0.012;
  float distanceToHorizon = abs(p.y - horizon);
  float halo = exp(-distanceToHorizon * 13.0);
  float core = exp(-distanceToHorizon * 150.0);
  float beam = exp(-abs(p.y - horizon - p.x * 0.09) * 30.0) * smoothstep(-0.72, 0.30, p.x);
  float bands = 0.5 + 0.5 * sin(p.x * (5.0 + uDispersion * 12.0) - time * 1.8);
  vec3 caustic = palette(bands);

  vec3 color = uBackground;
  color += uColorA * cyanWash * (0.55 + uGlow * 0.24);
  color += uColorB * violetWash * (0.50 + uGlow * 0.22);
  color += uColorC * coralWash * (0.46 + uGlow * 0.18);
  color += mix(palette(0.33), palette(0.67), p.x * 0.5 + 0.5) * halo * (0.42 + uBloom * 0.42);
  color += caustic * beam * (0.28 + uBloom * 0.48);
  color += vec3(1.0, 0.98, 0.94) * core * (0.42 + uGlow * 0.38);

  // Preserve a dark edge around the colour field and tone-map the additive
  // light, which avoids a flat clipped strip on bright palettes.
  float vignette = 1.0 - smoothstep(0.32, 1.05, length(p * vec2(0.82, 1.08)));
  color *= 0.42 + vignette * 0.58;
  color = 1.0 - exp(-color * max(uIntensity, 0.0));
  color = ngbHueShift(color, uHueShift);
  color += ngbNoise(gl_FragCoord.xy * 1.3 + time * 60.0) * uNoise * 0.08;
  color += ngbDither(gl_FragCoord.xy) / 255.0;

  gl_FragColor = vec4(max(color, 0.0), 1.0);
}
`;

/**
 * Diffuse coloured light converging into a bright prismatic caustic. It is an
 * original, full-screen lighting study: no mesh, texture, or copied component
 * code is involved.
 *
 * ```html
 * <ngb-prism class="absolute inset-0 -z-10" [colors]="['#52d9ff', '#8b7cff', '#ff9c69']" />
 * ```
 */
@Component({
  selector: 'ngb-prism',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbPrism extends NgbOglBackgroundBase {
  /** `drift` is a gentle autonomous movement; `hover` also follows the pointer. */
  readonly animation = input<NgbPrismAnimation>('drift');
  /** Three colours used for the diffuse field and its split-light caustic. */
  readonly colors = input<readonly string[]>(['#52d9ff', '#8b7cff', '#ff9c69']);
  /** Opaque base underneath the coloured light. */
  readonly backgroundColor = input('#02030a');
  /** Screen-space zoom. Values above 1 make the colour field larger. */
  readonly scale = input(1, { transform: numberAttribute });
  /** Overall exposure after the light layers have been composed. */
  readonly intensity = input(1.35, { transform: numberAttribute });
  /** Global time multiplier. `0` freezes autonomous motion. */
  readonly timeScale = input(0.5, { transform: numberAttribute });
  /** Strength of the broad, coloured light leaks. */
  readonly glow = input(1, { transform: numberAttribute });
  /** Strength of the horizon halo and split caustic. */
  readonly bloom = input(1, { transform: numberAttribute });
  /** Hue rotation applied after the lighting is composed, in radians. */
  readonly hueShift = input(0, { transform: numberAttribute });
  /** Width and separation of the colour bands in the caustic. */
  readonly dispersion = input(0.6, { transform: numberAttribute });
  /** Film grain added after tone mapping. `0` disables it. */
  readonly noise = input(0.025, { transform: numberAttribute });
  /** Horizontal offset, as a fraction of the element width. */
  readonly offsetX = input(0, { transform: numberAttribute });
  /** Vertical offset, as a fraction of the element height. Positive is down. */
  readonly offsetY = input(0, { transform: numberAttribute });
  /** Pointer tilt sensitivity when `animation="hover"`. */
  readonly hoverStrength = input(1, { transform: numberAttribute });

  protected override trackPointer = true;
  protected override pointerSmoothing = 0.06;
  protected readonly fragment = FRAGMENT;

  private phase = 0;

  protected override rendererOptions() {
    return { alpha: false, antialias: false, depth: false };
  }

  protected buildUniforms(): NgbUniforms {
    return {
      uPointer: { value: [0.5, 0.5] },
      uOffset: { value: [0, 0] },
      uBackground: { value: [0.01, 0.01, 0.04] },
      uColorA: { value: [0.32, 0.85, 1] },
      uColorB: { value: [0.55, 0.49, 1] },
      uColorC: { value: [1, 0.61, 0.41] },
      uScale: { value: 1 },
      uIntensity: { value: 1.35 },
      uGlow: { value: 1 },
      uBloom: { value: 1 },
      uHueShift: { value: 0 },
      uDispersion: { value: 0.6 },
      uNoise: { value: 0.025 },
    };
  }

  protected override syncUniforms(): void {
    const [colorA, colorB, colorC] = toRgbList(this.colors(), 3, [1, 1, 1]);
    this.setUniform('uBackground', toRgb(this.backgroundColor(), [0.01, 0.01, 0.04]));
    this.setUniform('uColorA', colorA);
    this.setUniform('uColorB', colorB);
    this.setUniform('uColorC', colorC);
    this.setUniform('uScale', this.scale());
    this.setUniform('uIntensity', this.intensity());
    this.setUniform('uGlow', this.glow());
    this.setUniform('uBloom', this.bloom());
    this.setUniform('uHueShift', this.hueShift());
    this.setUniform('uDispersion', this.dispersion());
    this.setUniform('uNoise', this.noise());
    this.setUniform('uOffset', [this.offsetX(), -this.offsetY()]);
  }

  protected override update(_time: number, delta: number): void {
    const animation = this.animation();
    if (animation !== 'still') this.phase += delta * this.timeScale();
    this.setUniform('uTime', animation === 'still' ? 0 : this.phase);

    const pointer = animation === 'hover' ? this.hoverStrength() : 0;
    this.setUniform('uPointer', [
      0.5 + (this.pointer.sx - 0.5) * pointer,
      0.5 + (0.5 - this.pointer.sy) * pointer,
    ]);
  }
}
