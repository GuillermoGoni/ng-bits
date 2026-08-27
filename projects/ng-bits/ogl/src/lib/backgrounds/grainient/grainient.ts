import { ChangeDetectionStrategy, Component, input, numberAttribute } from '@angular/core';

import { NGB_BACKGROUND_STYLES } from '@guillermogoni/ng-bits';
import { toRgbList } from '@guillermogoni/ng-bits';
import { NgbOglBackgroundBase, NgbUniforms } from '../../core/ogl-background-base';
import {
  NGB_CHUNK_COLOR,
  NGB_CHUNK_DITHER,
  NGB_CHUNK_NOISE2,
  NGB_CHUNK_NOISE3,
  NGB_CHUNK_UV,
} from '@guillermogoni/ng-bits';

const FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform int uStopCount;
uniform float uSpeed;
uniform float uWarp;
uniform float uScale;
uniform float uGrain;
uniform float uGrainScale;
uniform float uAngle;

varying vec2 vUv;

${NGB_CHUNK_UV}
${NGB_CHUNK_NOISE2}
${NGB_CHUNK_NOISE3}
${NGB_CHUNK_COLOR}
${NGB_CHUNK_DITHER}

void main() {
  float t = uTime * uSpeed;
  vec2 uv = ngbRotate(uAngle) * (vUv - 0.5) + 0.5;
  vec2 p = uv * uScale;

  // Domain warping: two fbm offsets feed the coordinate of the ramp lookup.
  vec2 q = vec2(ngbFbm3(vec3(p, t * 0.15), 4), ngbFbm3(vec3(p + 5.2, t * 0.13), 4));
  vec2 r = vec2(
    ngbFbm3(vec3(p + q * uWarp + vec2(1.7, 9.2), t * 0.11), 3),
    ngbFbm3(vec3(p + q * uWarp + vec2(8.3, 2.8), t * 0.17), 3)
  );

  float mixer = clamp(uv.x + uv.y * 0.35 + dot(r, vec2(0.8)) * uWarp, 0.0, 1.0);
  vec3 color = ngbRamp(uColor0, uColor1, uColor2, uColor3, uStopCount, mixer);

  // Soften the mid-tones so the ramp does not look like a hard gradient.
  color *= 0.85 + 0.15 * (ngbFbm3(vec3(p * 1.5, t * 0.2), 3) * 0.5 + 0.5);

  // Film grain, scaled in screen space so it stays crisp at any DPR.
  float grain = ngbNoise(gl_FragCoord.xy * uGrainScale + t * 60.0);
  color += grain * uGrain;

  color += ngbDither(gl_FragCoord.xy) / 255.0;

  gl_FragColor = vec4(color, 1.0);
}
`;

/**
 * A slow domain-warped mesh gradient with film grain on top — the "expensive
 * SaaS landing page" look, in one draw call.
 *
 * ```html
 * <ngb-grainient class="absolute inset-0 -z-10"
 *   [colors]="['#0f0c29','#302b63','#24243e']" [grain]="0.08" />
 * ```
 */
@Component({
  selector: 'ngb-grainient',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbGrainient extends NgbOglBackgroundBase {
  /** Two to four gradient stops. */
  readonly colors = input<readonly string[]>(['#0f0c29', '#302b63', '#24243e']);
  /** Animation speed. */
  readonly speed = input(1, { transform: numberAttribute });
  /** How much the gradient is distorted by noise. */
  readonly warp = input(0.6, { transform: numberAttribute });
  /** Feature size — lower means larger, calmer blobs. */
  readonly scale = input(1.4, { transform: numberAttribute });
  /** Grain strength, 0..1. */
  readonly grain = input(0.06, { transform: numberAttribute });
  /** Grain frequency in device pixels. */
  readonly grainScale = input(0.9, { transform: numberAttribute });
  /** Gradient rotation in radians. */
  readonly angle = input(0, { transform: numberAttribute });

  protected readonly fragment = FRAGMENT;

  protected override rendererOptions() {
    return { alpha: false, antialias: false, depth: false };
  }

  protected buildUniforms(): NgbUniforms {
    return {
      uColor0: { value: [0, 0, 0] },
      uColor1: { value: [0, 0, 0] },
      uColor2: { value: [0, 0, 0] },
      uColor3: { value: [0, 0, 0] },
      uStopCount: { value: 3 },
      uSpeed: { value: 1 },
      uWarp: { value: 0.6 },
      uScale: { value: 1.4 },
      uGrain: { value: 0.06 },
      uGrainScale: { value: 0.9 },
      uAngle: { value: 0 },
    };
  }

  protected override syncUniforms(): void {
    const requested = this.colors();
    const count = Math.max(2, Math.min(4, requested.length));
    const [c0, c1, c2, c3] = toRgbList(requested, 4);
    this.setUniform('uColor0', c0);
    this.setUniform('uColor1', c1);
    this.setUniform('uColor2', c2);
    this.setUniform('uColor3', c3);
    this.setUniform('uStopCount', count);
    this.setUniform('uSpeed', this.speed());
    this.setUniform('uWarp', this.warp());
    this.setUniform('uScale', this.scale());
    this.setUniform('uGrain', this.grain());
    this.setUniform('uGrainScale', this.grainScale());
    this.setUniform('uAngle', this.angle());
  }
}
