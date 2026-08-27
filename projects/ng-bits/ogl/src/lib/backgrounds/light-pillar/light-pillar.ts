import { ChangeDetectionStrategy, Component, input, numberAttribute } from '@angular/core';

import { NGB_BACKGROUND_STYLES } from '@guillermogoni/ng-bits';
import { toRgbList } from '@guillermogoni/ng-bits';
import { NgbOglBackgroundBase, NgbUniforms } from '../../core/ogl-background-base';
import {
  NGB_CHUNK_COLOR,
  NGB_CHUNK_DITHER,
  NGB_CHUNK_NOISE3,
  NGB_CHUNK_UV,
} from '@guillermogoni/ng-bits';

const MAX_PILLARS = 8;

const FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform int uStopCount;
uniform int uCount;
uniform float uSpeed;
uniform float uWidth;
uniform float uHeight;
uniform float uIntensity;
uniform float uFlicker;
uniform float uSpread;
uniform float uFloorGlow;

varying vec2 vUv;

${NGB_CHUNK_UV}
${NGB_CHUNK_NOISE3}
${NGB_CHUNK_COLOR}
${NGB_CHUNK_DITHER}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = vec2((vUv.x - 0.5) * aspect, vUv.y);
  float t = uTime * uSpeed;

  vec3 total = vec3(0.0);

  for (int i = 0; i < ${MAX_PILLARS}; i++) {
    if (i >= uCount) break;
    float fi = float(i);
    float slot = uCount > 1 ? fi / float(uCount - 1) - 0.5 : 0.0;

    // Pillars sway slowly and independently around their slot.
    float sway = ngbNoise3(vec3(fi * 3.7, 0.0, t * 0.3)) * 0.06;
    float x = slot * uSpread * aspect + sway;

    // Width tapers towards the top, like a real light shaft.
    float taper = mix(1.0, 2.4, vUv.y);
    float w = max(uWidth, 0.001) * taper;
    float dx = (p.x - x) / w;
    float core = exp(-dx * dx);

    // Vertical envelope: bright at the floor, fading out at uHeight.
    float rise = smoothstep(0.0, 0.08, vUv.y);
    float fall = smoothstep(uHeight, uHeight * 0.35, vUv.y);
    float shaft = core * rise * fall;

    // Volumetric striations drifting upwards inside the shaft.
    float dust = ngbFbm3(vec3(p.x * 6.0, vUv.y * 2.2 - t * 0.5, fi * 7.1), 3) * 0.5 + 0.5;
    shaft *= mix(0.55, 1.15, dust);

    // Per-pillar flicker.
    float flicker = 1.0 + (ngbNoise3(vec3(fi * 11.3, 0.0, t * 3.0))) * uFlicker;
    shaft *= max(flicker, 0.0);

    // A pool of light where the pillar meets the floor.
    float pool = exp(-dx * dx * 0.25) * exp(-vUv.y * 26.0) * uFloorGlow;

    vec3 color = ngbRamp(uColor0, uColor1, uColor2, uColor3, uStopCount,
                         uCount > 1 ? fi / float(uCount - 1) : 0.5);
    total += color * (shaft + pool);
  }

  total *= uIntensity;
  float alpha = clamp(max(max(total.r, total.g), total.b), 0.0, 1.0);
  total += ngbDither(gl_FragCoord.xy) / 255.0;

  gl_FragColor = vec4(total, alpha);
}
`;

/**
 * Vertical volumetric light shafts rising from the bottom edge, with drifting
 * dust and a pool of light at the base.
 *
 * ```html
 * <ngb-light-pillar class="absolute inset-0 -z-10" [count]="3" [colors]="['#00d4ff','#7b61ff']" />
 * ```
 */
@Component({
  selector: 'ngb-light-pillar',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbLightPillar extends NgbOglBackgroundBase {
  /** Number of shafts, 1..8. */
  readonly count = input(3, { transform: numberAttribute });
  /** Two to four colours, distributed across the shafts. */
  readonly colors = input<readonly string[]>(['#00d4ff', '#7b61ff', '#ff5ea8']);
  /** Animation speed. */
  readonly speed = input(1, { transform: numberAttribute });
  /** Shaft width at the base. */
  readonly width = input(0.05, { transform: numberAttribute });
  /** How far up the element the shafts reach, 0..1. */
  readonly height = input(0.9, { transform: numberAttribute });
  /** Overall brightness. */
  readonly intensity = input(1, { transform: numberAttribute });
  /** Amount of per-shaft flicker, 0..1. */
  readonly flicker = input(0.15, { transform: numberAttribute });
  /** How far apart the shafts sit, 0..1 of the width. */
  readonly spread = input(0.7, { transform: numberAttribute });
  /** Brightness of the pool of light at the base. */
  readonly floorGlow = input(0.6, { transform: numberAttribute });

  protected readonly fragment = FRAGMENT;

  protected buildUniforms(): NgbUniforms {
    return {
      uColor0: { value: [0, 0.83, 1] },
      uColor1: { value: [0.48, 0.38, 1] },
      uColor2: { value: [1, 0.37, 0.66] },
      uColor3: { value: [1, 0.37, 0.66] },
      uStopCount: { value: 3 },
      uCount: { value: 3 },
      uSpeed: { value: 1 },
      uWidth: { value: 0.05 },
      uHeight: { value: 0.9 },
      uIntensity: { value: 1 },
      uFlicker: { value: 0.15 },
      uSpread: { value: 0.7 },
      uFloorGlow: { value: 0.6 },
    };
  }

  protected override syncUniforms(): void {
    const requested = this.colors();
    const [c0, c1, c2, c3] = toRgbList(requested, 4);
    this.setUniform('uColor0', c0);
    this.setUniform('uColor1', c1);
    this.setUniform('uColor2', c2);
    this.setUniform('uColor3', c3);
    this.setUniform('uStopCount', Math.max(2, Math.min(4, requested.length)));
    this.setUniform('uCount', Math.max(1, Math.min(MAX_PILLARS, Math.round(this.count()))));
    this.setUniform('uSpeed', this.speed());
    this.setUniform('uWidth', this.width());
    this.setUniform('uHeight', this.height());
    this.setUniform('uIntensity', this.intensity());
    this.setUniform('uFlicker', this.flicker());
    this.setUniform('uSpread', this.spread());
    this.setUniform('uFloorGlow', this.floorGlow());
  }
}
