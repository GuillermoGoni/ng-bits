import { ChangeDetectionStrategy, Component, input, numberAttribute } from '@angular/core';

import { NGB_BACKGROUND_STYLES } from '../../core/background-base';
import { toRgbList } from '../../core/color';
import { NgbOglBackgroundBase, NgbUniforms } from '../../core/ogl-background-base';
import {
  NGB_CHUNK_COLOR,
  NGB_CHUNK_DITHER,
  NGB_CHUNK_NOISE2,
  NGB_CHUNK_UV,
} from '../../core/shader-chunks';

const FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform float uAmplitude;
uniform float uBlend;
uniform float uSpeed;
uniform float uIntensity;
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;

varying vec2 vUv;

${NGB_CHUNK_UV}
${NGB_CHUNK_NOISE2}
${NGB_CHUNK_COLOR}
${NGB_CHUNK_DITHER}

void main() {
  vec2 uv = vUv;
  float t = uTime * uSpeed;
  float phase = t * 1.15;

  // Let the colour ramp breathe with the curtain, rather than leaving it as
  // a static gradient beneath a barely moving edge.
  float colourFlow = sin(uv.y * 7.0 - phase) * 0.045;
  colourFlow += sin(uv.y * 15.0 + phase * 1.7) * 0.018;
  vec3 ramp = ngbRamp(uColor0, uColor1, uColor2, uColor2, 3, clamp(uv.x + colourFlow, 0.0, 1.0));

  // The long waves make the movement legible at a glance; the noise stops
  // them from reading as a mechanical sine wave.
  float wobble = ngbFbm(vec2(uv.x * 2.4 + phase * 0.42, phase * 0.62), 3);
  float waves = sin(uv.x * 7.0 + phase) * 0.15;
  waves += sin(uv.x * 15.0 - phase * 1.55) * 0.07;
  float reach = 0.52 * uAmplitude * exp(wobble * 0.72) * (1.0 + waves);

  // Depth measured from the top edge, where the curtain is anchored.
  float depth = 1.0 - uv.y;
  float falloff = 1.0 - clamp(depth / max(reach, 0.001), 0.0, 1.0);

  // Low blend keeps a defined edge; high blend smears it into a soft wash.
  float alpha = pow(falloff, mix(3.5, 0.7, clamp(uBlend, 0.0, 1.0)));

  // Moving ribbons make the flow visible across the whole curtain, not just
  // at its lower silhouette.
  float strands = 0.5 + 0.5 * sin(uv.x * 18.0 + depth * 9.0 - phase * 1.9);
  float texture = ngbFbm(vec2(uv.x * 8.0 + phase * 0.8, depth * 3.0 - phase * 0.45), 2) * 0.5 + 0.5;
  alpha *= 0.76 + 0.24 * mix(texture, strands, 0.6);

  alpha = clamp(alpha * uIntensity, 0.0, 1.0);

  vec3 rgb = ramp * alpha;
  rgb += ngbDither(gl_FragCoord.xy) / 255.0;

  gl_FragColor = vec4(rgb, alpha);
}
`;

/**
 * A soft aurora curtain anchored to the top edge, its colour ramping left to
 * right across three stops and its lower edge drifting on noise. Transparent,
 * so it composites over whatever sits behind it.
 *
 * ```html
 * <ngb-aurora class="absolute inset-0 -z-10" [colorStops]="['#7cff67','#B497CF','#5227FF']" />
 * ```
 */
@Component({
  selector: 'ngb-aurora',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbAurora extends NgbOglBackgroundBase {
  /** Three colours sampled left to right across the curtain. */
  readonly colorStops = input<readonly string[]>(['#7cff67', '#B497CF', '#5227FF']);
  /** How far down the element the curtain reaches. */
  readonly amplitude = input(1, { transform: numberAttribute });
  /** 0 keeps a defined lower edge, 1 smears it into a soft wash. */
  readonly blend = input(0.5, { transform: numberAttribute });
  /** Animation speed multiplier. */
  readonly speed = input(1, { transform: numberAttribute });
  /** Overall opacity. */
  readonly intensity = input(1, { transform: numberAttribute });

  protected readonly fragment = FRAGMENT;

  protected buildUniforms(): NgbUniforms {
    return {
      uAmplitude: { value: 1 },
      uBlend: { value: 0.5 },
      uSpeed: { value: 1 },
      uIntensity: { value: 1 },
      uColor0: { value: [0, 0, 0] },
      uColor1: { value: [0, 0, 0] },
      uColor2: { value: [0, 0, 0] },
    };
  }

  protected override syncUniforms(): void {
    const [c0, c1, c2] = toRgbList(this.colorStops(), 3);
    this.setUniform('uColor0', c0);
    this.setUniform('uColor1', c1);
    this.setUniform('uColor2', c2);
    this.setUniform('uAmplitude', this.amplitude());
    this.setUniform('uBlend', this.blend());
    this.setUniform('uSpeed', this.speed());
    this.setUniform('uIntensity', this.intensity());
  }
}
