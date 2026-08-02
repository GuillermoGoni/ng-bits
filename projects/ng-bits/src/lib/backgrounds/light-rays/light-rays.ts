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
import { NGB_CHUNK_DITHER, NGB_CHUNK_NOISE2, NGB_CHUNK_UV } from '../../core/shader-chunks';

/** Where the light comes from, in element space. */
export type NgbRaysOrigin =
  | 'top-center'
  | 'top-left'
  | 'top-right'
  | 'left'
  | 'right'
  | 'bottom-center'
  | 'bottom-left'
  | 'bottom-right';

const ORIGINS: Record<NgbRaysOrigin, [number, number]> = {
  'top-center': [0.5, 1.0],
  'top-left': [0.0, 1.0],
  'top-right': [1.0, 1.0],
  left: [0.0, 0.5],
  right: [1.0, 0.5],
  'bottom-center': [0.5, 0.0],
  'bottom-left': [0.0, 0.0],
  'bottom-right': [1.0, 0.0],
};

const FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uOrigin;
uniform vec3 uColor;
uniform float uSpeed;
uniform float uSpread;
uniform float uLength;
uniform float uFade;
uniform float uPulse;
uniform float uNoise;
uniform float uSaturation;
uniform float uIntensity;

varying vec2 vUv;

${NGB_CHUNK_UV}
${NGB_CHUNK_NOISE2}
${NGB_CHUNK_DITHER}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);

  vec2 p = vUv - uOrigin;
  p.x *= aspect;

  float dist = length(p);
  float angle = atan(p.y, p.x);

  float t = uTime * uSpeed;

  // Layered angular noise gives rays of several widths at once.
  float band = ngbNoise(vec2(angle * 6.0, t * 0.35)) * 0.55;
  band += ngbNoise(vec2(angle * 15.0, t * 0.5 + 11.0)) * 0.30;
  band += ngbNoise(vec2(angle * 33.0, t * 0.7 + 23.0)) * 0.15;
  band = band * 0.5 + 0.5;

  // Tight spread -> high exponent -> narrow, well-separated shafts.
  float rays = pow(clamp(band, 0.0, 1.0), mix(6.0, 1.2, clamp(uSpread, 0.0, 1.0)));

  // Shafts get longer and softer the further they travel.
  float reach = exp(-dist / max(uLength, 0.001));
  float horizon = smoothstep(uFade, 0.0, dist);

  float pulse = mix(1.0, 0.75 + 0.25 * sin(t * 2.0 + angle * 3.0), uPulse);

  // A bright core near the source keeps the shafts from reading as haze.
  float core = exp(-dist * 3.5) * 0.6;

  float intensity = (rays * reach * horizon + core * horizon) * pulse * uIntensity;
  intensity += ngbNoise(vUv * 220.0 + t) * uNoise * intensity;
  intensity = max(intensity, 0.0);

  float luma = dot(uColor, vec3(0.2126, 0.7152, 0.0722));
  vec3 color = mix(vec3(luma), uColor, uSaturation);

  vec3 rgb = color * intensity;
  rgb += ngbDither(gl_FragCoord.xy) / 255.0;

  gl_FragColor = vec4(rgb, clamp(intensity, 0.0, 1.0));
}
`;

/**
 * Volumetric god rays fanning out from a configurable origin. Additive by
 * nature, so it reads best over a dark background.
 *
 * ```html
 * <ngb-light-rays class="absolute inset-0 -z-10" origin="top-center" color="#c8b4ff" followMouse />
 * ```
 */
@Component({
  selector: 'ngb-light-rays',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbLightRays extends NgbOglBackgroundBase {
  /** Anchor point the rays emanate from. */
  readonly origin = input<NgbRaysOrigin>('top-center');
  /** Ray colour. */
  readonly color = input('#ffffff');
  /** Animation speed. */
  readonly speed = input(1, { transform: numberAttribute });
  /** 0 = narrow separated shafts, 1 = a broad wash. */
  readonly spread = input(0.6, { transform: numberAttribute });
  /** How far the rays travel before dimming out. */
  readonly rayLength = input(1.2, { transform: numberAttribute });
  /** Distance at which the rays are fully faded. */
  readonly fadeDistance = input(1.4, { transform: numberAttribute });
  /** Amount of rhythmic brightening, 0..1. */
  readonly pulsating = input(0, { transform: numberAttribute });
  /** Film-grain style noise mixed into the rays, 0..1. */
  readonly noiseAmount = input(0.1, { transform: numberAttribute });
  /** 0 = greyscale, 1 = full colour. */
  readonly saturation = input(1, { transform: numberAttribute });
  /** Overall brightness. */
  readonly intensity = input(2.5, { transform: numberAttribute });
  /** Let the pointer drag the light source around. */
  readonly followMouse = input(false, { transform: booleanAttribute });
  /** How far the pointer pulls the origin, 0..1. */
  readonly mouseInfluence = input(0.35, { transform: numberAttribute });

  protected override trackPointer = true;
  protected override pointerSmoothing = 0.05;
  protected readonly fragment = FRAGMENT;

  protected buildUniforms(): NgbUniforms {
    return {
      uOrigin: { value: [0.5, 1.0] },
      uColor: { value: [1, 1, 1] },
      uSpeed: { value: 1 },
      uSpread: { value: 0.6 },
      uLength: { value: 1.2 },
      uFade: { value: 1.4 },
      uPulse: { value: 0 },
      uNoise: { value: 0.1 },
      uSaturation: { value: 1 },
      uIntensity: { value: 2.5 },
    };
  }

  protected override syncUniforms(): void {
    this.setUniform('uColor', toRgb(this.color()));
    this.setUniform('uSpeed', this.speed());
    this.setUniform('uSpread', this.spread());
    this.setUniform('uLength', this.rayLength());
    this.setUniform('uFade', this.fadeDistance());
    this.setUniform('uPulse', this.pulsating());
    this.setUniform('uNoise', this.noiseAmount());
    this.setUniform('uSaturation', this.saturation());
    this.setUniform('uIntensity', this.intensity());
    if (!this.followMouse()) this.setUniform('uOrigin', ORIGINS[this.origin()]);
  }

  protected override update(): void {
    if (!this.followMouse()) return;
    const [ox, oy] = ORIGINS[this.origin()];
    const k = this.mouseInfluence();
    this.setUniform('uOrigin', [
      ox + (this.pointer.sx - ox) * k,
      oy + (1 - this.pointer.sy - oy) * k,
    ]);
  }
}
