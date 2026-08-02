import { ChangeDetectionStrategy, Component, input, numberAttribute } from '@angular/core';

import { NGB_BACKGROUND_STYLES } from '../../core/background-base';
import { toRgbList } from '../../core/color';
import { NgbOglBackgroundBase, NgbUniforms } from '../../core/ogl-background-base';
import { NGB_CHUNK_DITHER, NGB_CHUNK_NOISE3, NGB_CHUNK_UV } from '../../core/shader-chunks';

const FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uSpeed;
uniform float uSoftness;
uniform float uIntensity;
uniform float uScale;

varying vec2 vUv;

${NGB_CHUNK_UV}
${NGB_CHUNK_NOISE3}
${NGB_CHUNK_DITHER}

// One drifting light blob. Radius is generous so blobs overlap and blend.
float blob(vec2 p, vec2 centre, float radius) {
  float d = length(p - centre) / max(radius, 0.001);
  return exp(-d * d);
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0) * uScale;
  float t = uTime * uSpeed * 0.25;

  // Each blob follows its own slow Lissajous path.
  vec2 a = vec2(sin(t * 0.9) * 0.35, cos(t * 0.7) * 0.22 + 0.12);
  vec2 b = vec2(cos(t * 0.6 + 1.4) * 0.42, sin(t * 0.8 + 0.6) * 0.26 - 0.08);
  vec2 c = vec2(sin(t * 0.5 + 3.1) * 0.30, cos(t * 0.55 + 2.2) * 0.30);

  float radius = mix(0.18, 0.55, clamp(uSoftness, 0.0, 1.0));

  float wa = blob(p, a, radius);
  float wb = blob(p, b, radius * 1.15);
  float wc = blob(p, c, radius * 0.9);

  // Gentle noise breaks up the perfectly elliptical falloff.
  float grain = ngbFbm3(vec3(p * 1.8, t * 0.6), 3) * 0.5 + 0.5;
  wa *= 0.75 + 0.5 * grain;
  wb *= 0.75 + 0.5 * (1.0 - grain);
  wc *= 0.8 + 0.4 * grain;

  float total = wa + wb + wc;
  vec3 color = (uColor0 * wa + uColor1 * wb + uColor2 * wc) / max(total, 0.0001);

  float alpha = clamp(total * uIntensity * 0.6, 0.0, 1.0);
  vec3 rgb = color * alpha;
  rgb += ngbDither(gl_FragCoord.xy) / 255.0;

  gl_FragColor = vec4(rgb, alpha);
}
`;

/**
 * Three oversized, slowly drifting light blobs — the calm, blurred cousin of
 * {@link NgbAurora}. Transparent, so it layers over any surface.
 *
 * ```html
 * <ngb-soft-aurora class="absolute inset-0 -z-10"
 *   [colors]="['#ff7ab6','#7b9cff','#7ce7d1']" [softness]="0.8" />
 * ```
 */
@Component({
  selector: 'ngb-soft-aurora',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbSoftAurora extends NgbOglBackgroundBase {
  /** Three blob colours. */
  readonly colors = input<readonly string[]>(['#ff7ab6', '#7b9cff', '#7ce7d1']);
  /** Drift speed. */
  readonly speed = input(1, { transform: numberAttribute });
  /** Blob radius / blur, 0..1. */
  readonly softness = input(0.7, { transform: numberAttribute });
  /** Overall opacity multiplier. */
  readonly intensity = input(1, { transform: numberAttribute });
  /** Zoom — lower values push the blobs off-canvas for a subtler wash. */
  readonly scale = input(1, { transform: numberAttribute });

  protected readonly fragment = FRAGMENT;

  protected buildUniforms(): NgbUniforms {
    return {
      uColor0: { value: [1, 0.48, 0.71] },
      uColor1: { value: [0.48, 0.61, 1] },
      uColor2: { value: [0.49, 0.91, 0.82] },
      uSpeed: { value: 1 },
      uSoftness: { value: 0.7 },
      uIntensity: { value: 1 },
      uScale: { value: 1 },
    };
  }

  protected override syncUniforms(): void {
    const [c0, c1, c2] = toRgbList(this.colors(), 3);
    this.setUniform('uColor0', c0);
    this.setUniform('uColor1', c1);
    this.setUniform('uColor2', c2);
    this.setUniform('uSpeed', this.speed());
    this.setUniform('uSoftness', this.softness());
    this.setUniform('uIntensity', this.intensity());
    this.setUniform('uScale', this.scale());
  }
}
