import { ChangeDetectionStrategy, Component, input, numberAttribute } from '@angular/core';

import { NGB_BACKGROUND_STYLES } from '@guillermogoni/ng-bits';
import { toRgb } from '@guillermogoni/ng-bits';
import { NgbOglBackgroundBase, NgbUniforms } from '../../core/ogl-background-base';
import { NGB_CHUNK_DITHER, NGB_CHUNK_UV } from '@guillermogoni/ng-bits';

const FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColor;
uniform float uSpeed;
uniform float uScale;
uniform float uRotation;
uniform float uGrain;

varying vec2 vUv;

${NGB_CHUNK_UV}
${NGB_CHUNK_DITHER}

// Cheap pseudo-random used only for the fabric grain.
float silkNoise(vec2 p) {
  vec2 r = 2.71828 * sin(2.71828 * p);
  return fract(r.x * r.y * 1.0);
}

void main() {
  float t = uTime * uSpeed;

  vec2 uv = ngbRotate(uRotation) * (vUv - 0.5) * uScale + 0.5;

  // Warp the weave so the highlights slide instead of just scrolling.
  uv.y += 0.03 * sin(8.0 * uv.x - t);
  uv.x += 0.02 * cos(6.0 * uv.y + t * 0.8);

  float weave = 5.0 * (uv.x + uv.y + cos(3.0 * uv.x + 5.0 * uv.y) + 0.02 * t);
  float pattern = 0.6 + 0.4 * sin(weave + sin(20.0 * (uv.x + uv.y - 0.1 * t)));

  vec3 color = uColor * pattern;
  color -= silkNoise(gl_FragCoord.xy) * uGrain * 0.06;
  color += ngbDither(gl_FragCoord.xy) / 255.0;

  gl_FragColor = vec4(max(color, 0.0), 1.0);
}
`;

/**
 * Rippling satin sheen. Opaque by design — it is a full canvas fill, so give
 * it a `color` that works as your page background.
 *
 * ```html
 * <ngb-silk class="absolute inset-0 -z-10" color="#7b7481" [speed]="5" />
 * ```
 */
@Component({
  selector: 'ngb-silk',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbSilk extends NgbOglBackgroundBase {
  /** Base fabric colour. */
  readonly color = input('#7b7481');
  /** Animation speed. */
  readonly speed = input(5, { transform: numberAttribute });
  /** Weave density — higher means finer folds. */
  readonly scale = input(1, { transform: numberAttribute });
  /** Weave rotation in radians. */
  readonly rotation = input(0, { transform: numberAttribute });
  /** Amount of fabric grain, 0..1. */
  readonly grain = input(1.5, { transform: numberAttribute });

  protected readonly fragment = FRAGMENT;

  protected override rendererOptions() {
    return { alpha: false, antialias: false, depth: false };
  }

  protected buildUniforms(): NgbUniforms {
    return {
      uColor: { value: [0.48, 0.45, 0.5] },
      uSpeed: { value: 5 },
      uScale: { value: 1 },
      uRotation: { value: 0 },
      uGrain: { value: 1.5 },
    };
  }

  protected override syncUniforms(): void {
    this.setUniform('uColor', toRgb(this.color(), [0.48, 0.45, 0.5]));
    this.setUniform('uSpeed', this.speed() * 0.2);
    this.setUniform('uScale', this.scale());
    this.setUniform('uRotation', this.rotation());
    this.setUniform('uGrain', this.grain());
  }
}
