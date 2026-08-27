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

const FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uAmplitude;
uniform float uSaturation;
uniform vec3 uColor;

varying vec2 vUv;

void main() {
  // Square the coordinate space so the pattern never stretches with the element.
  float minSide = min(uResolution.x, uResolution.y);
  vec2 uv = (vUv * 2.0 - 1.0) * uResolution / minSide;

  uv += (uMouse - 0.5) * uAmplitude;

  // Two coupled accumulators fed back into each other. The feedback is what
  // produces the thin-film banding — neither term settles, so the bands keep
  // folding over one another.
  float phase = -uTime * 0.5;
  float wave = 0.0;

  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    wave += cos(fi - phase - wave * uv.x);
    phase += sin(uv.y * fi + wave);
  }

  phase += uTime * 0.5;

  vec3 color = vec3(cos(uv * vec2(phase, wave)) * 0.6 + 0.4, cos(wave + phase) * 0.5 + 0.5);
  color = cos(color * cos(vec3(phase, wave, 2.5)) * 0.5 + 0.5);

  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luma), color, uSaturation);

  gl_FragColor = vec4(color * uColor, 1.0);
}
`;

/**
 * Shifting thin-film interference bands. Two coupled accumulators feed back
 * into each other every iteration, so the colour fringes keep folding instead
 * of settling into a repeating pattern.
 *
 * Opaque by design — `color` multiplies the whole image, so it doubles as the
 * page background.
 *
 * ```html
 * <ngb-iridescence class="absolute inset-0 -z-10" color="#8099cc" mouseReact />
 * ```
 */
@Component({
  selector: 'ngb-iridescence',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbIridescence extends NgbOglBackgroundBase {
  /** Base colour the whole image is multiplied by. */
  readonly color = input('#8099cc');
  /** Animation speed multiplier. */
  readonly speed = input(1, { transform: numberAttribute });
  /** How far the pointer shifts the pattern. */
  readonly amplitude = input(0.1, { transform: numberAttribute });
  /** 0 = greyscale, 1 = full colour. */
  readonly saturation = input(1, { transform: numberAttribute });
  /** Let the pointer move the pattern. */
  readonly mouseReact = input(true, { transform: booleanAttribute });

  protected override trackPointer = true;
  protected override pointerSmoothing = 0.06;
  protected readonly fragment = FRAGMENT;

  /** Integrated so changing `speed` does not jump the pattern. */
  private phase = 0;

  protected override rendererOptions() {
    return { alpha: false, antialias: false, depth: false };
  }

  protected buildUniforms(): NgbUniforms {
    return {
      uMouse: { value: [0.5, 0.5] },
      uAmplitude: { value: 0.1 },
      uSaturation: { value: 1 },
      uColor: { value: [0.5, 0.6, 0.8] },
    };
  }

  protected override syncUniforms(): void {
    this.setUniform('uColor', toRgb(this.color(), [0.5, 0.6, 0.8]));
    this.setUniform('uSaturation', this.saturation());
    this.setUniform('uAmplitude', this.mouseReact() ? this.amplitude() : 0);
  }

  protected override update(_time: number, delta: number): void {
    this.phase += delta * this.speed();
    this.setUniform('uTime', this.phase);

    if (this.mouseReact()) {
      this.setUniform('uMouse', [this.pointer.sx, 1 - this.pointer.sy]);
    }
  }
}
