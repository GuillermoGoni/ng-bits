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

  // The gradient runs left to right and never moves; only the shape does.
  vec3 ramp = ngbRamp(uColor0, uColor1, uColor2, uColor2, 3, uv.x);

  // How far the curtain reaches down, varying slowly along x.
  float wobble = ngbFbm(vec2(uv.x * 1.6 + t * 0.12, t * 0.22), 3);
  float reach = 0.55 * uAmplitude * exp(wobble * 0.55);

  // Depth measured from the top edge, where the curtain is anchored.
  float depth = 1.0 - uv.y;
  float falloff = 1.0 - clamp(depth / max(reach, 0.001), 0.0, 1.0);

  // Low blend keeps a defined edge; high blend smears it into a soft wash.
  float alpha = pow(falloff, mix(3.5, 0.7, clamp(uBlend, 0.0, 1.0)));

  // Just enough vertical structure to avoid a flat gradient, no filaments.
  alpha *= 0.88 + 0.12 * (ngbFbm(vec2(uv.x * 7.0, t * 0.3), 2) * 0.5 + 0.5);

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
