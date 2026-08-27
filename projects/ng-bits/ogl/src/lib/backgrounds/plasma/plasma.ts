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
import { NGB_CHUNK_COLOR, NGB_CHUNK_DITHER, NGB_CHUNK_UV } from '@guillermogoni/ng-bits';

/** Direction the plasma flows in. */
export type NgbPlasmaDirection = 'forward' | 'reverse' | 'pingpong';

const FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uMouseInfluence;
uniform vec3 uColor;
uniform float uTint;
uniform float uScale;
uniform float uOpacity;
uniform float uPhase;

varying vec2 vUv;

${NGB_CHUNK_UV}
${NGB_CHUNK_COLOR}
${NGB_CHUNK_DITHER}

void main() {
  vec2 p = ngbAspectUv(vUv, uResolution) * uScale * 6.0;
  p += (uMouse - 0.5) * uMouseInfluence * 4.0;

  float t = uPhase;

  // Four interfering wave fronts: the classic demoscene plasma.
  float f = sin(p.x + t);
  f += sin(p.y * 1.1 + t * 0.9);
  f += sin((p.x + p.y) * 0.7 + t * 1.3);
  f += sin(length(p) * 0.9 - t * 1.7);
  f *= 0.25;

  vec3 rainbow = 0.5 + 0.5 * cos(6.28318 * (f + vec3(0.0, 0.33, 0.67)) + t * 0.15);
  vec3 tinted = uColor * (0.35 + 0.65 * (f * 0.5 + 0.5));
  vec3 color = mix(rainbow, tinted, uTint);

  // Slight vignette keeps the corners from flattening out.
  float vignette = 1.0 - 0.35 * dot(vUv - 0.5, vUv - 0.5) * 2.0;
  color *= vignette;
  color += ngbDither(gl_FragCoord.xy) / 255.0;

  float alpha = uOpacity;
  gl_FragColor = vec4(color * alpha, alpha);
}
`;

/**
 * Interfering sine fronts — a modern take on the demoscene plasma. Set
 * `color` to tint it towards your brand, or leave `tint` at 0 for the full
 * spectrum.
 *
 * ```html
 * <ngb-plasma class="absolute inset-0 -z-10" color="#ff6b35" [tint]="0.8" mouseInteractive />
 * ```
 */
@Component({
  selector: 'ngb-plasma',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbPlasma extends NgbOglBackgroundBase {
  /** Tint colour, blended in by {@link tint}. */
  readonly color = input('#ffffff');
  /** 0 = full spectrum, 1 = monochrome in `color`. */
  readonly tint = input(0, { transform: numberAttribute });
  /** Animation speed. */
  readonly speed = input(1, { transform: numberAttribute });
  /** Pattern scale — higher means more, smaller cells. */
  readonly scale = input(1, { transform: numberAttribute });
  /** Layer opacity, 0..1. */
  readonly opacity = input(1, { transform: numberAttribute });
  /** Flow direction. */
  readonly direction = input<NgbPlasmaDirection>('forward');
  /** Let the pointer shift the wave origin. */
  readonly mouseInteractive = input(false, { transform: booleanAttribute });
  /** How far the pointer drags the pattern, 0..1. */
  readonly mouseInfluence = input(0.4, { transform: numberAttribute });

  protected override trackPointer = true;
  protected readonly fragment = FRAGMENT;

  protected buildUniforms(): NgbUniforms {
    return {
      uMouse: { value: [0.5, 0.5] },
      uMouseInfluence: { value: 0 },
      uColor: { value: [1, 1, 1] },
      uTint: { value: 0 },
      uScale: { value: 1 },
      uOpacity: { value: 1 },
      uPhase: { value: 0 },
    };
  }

  /** Integrated so flipping direction eases instead of jumping. */
  private phase = 0;

  protected override syncUniforms(): void {
    this.setUniform('uColor', toRgb(this.color()));
    this.setUniform('uTint', this.tint());
    this.setUniform('uScale', this.scale());
    this.setUniform('uOpacity', this.opacity());
    this.setUniform('uMouseInfluence', this.mouseInteractive() ? this.mouseInfluence() : 0);
  }

  protected override update(time: number, delta: number): void {
    const direction = this.direction();
    const sign =
      direction === 'reverse' ? -1 : direction === 'pingpong' ? Math.sin(time * 0.15) : 1;
    this.phase += delta * this.speed() * sign;
    this.setUniform('uPhase', this.phase);

    if (this.mouseInteractive()) {
      this.setUniform('uMouse', [this.pointer.sx, 1 - this.pointer.sy]);
    }
  }
}
