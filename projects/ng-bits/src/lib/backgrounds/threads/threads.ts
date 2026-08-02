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
import { NGB_CHUNK_NOISE2, NGB_CHUNK_UV } from '../../core/shader-chunks';

const LINE_COUNT = 36;

const FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uMouseInfluence;
uniform vec3 uColor;
uniform float uAmplitude;
uniform float uSpread;
uniform float uThickness;
uniform float uSpeed;

varying vec2 vUv;

${NGB_CHUNK_UV}
${NGB_CHUNK_NOISE2}

void main() {
  vec2 uv = vUv;
  float t = uTime * uSpeed;
  float glow = 0.0;

  for (int i = 0; i < ${LINE_COUNT}; i++) {
    float fi = float(i) / float(${LINE_COUNT} - 1);
    float centred = fi - 0.5;

    // Base position: threads fan out from the middle of the element.
    float y = 0.5 + centred * uSpread;

    // Two octaves of travelling wave, phase-offset per thread.
    float wave = ngbNoise(vec2(uv.x * 2.6 + fi * 3.0, t * 0.4 + fi * 2.0)) * 0.14;
    wave += sin(uv.x * 6.28318 * 1.5 + t * 0.9 + fi * 4.0) * 0.03;
    y += wave * uAmplitude;

    // Pointer pushes nearby threads away, falling off with distance.
    float mouseDist = distance(vec2(uv.x, y), uMouse);
    y += (y - uMouse.y) * exp(-mouseDist * 9.0) * uMouseInfluence;

    // Threads near the edges of the fan are thinner and dimmer.
    float taper = 1.0 - abs(centred) * 1.2;
    taper = clamp(taper, 0.15, 1.0);

    float width = uThickness * mix(0.4, 1.0, taper);
    float d = abs(uv.y - y);
    // Reaches 1.0 on the thread itself and falls off within a few widths,
    // so the filaments read as lines rather than haze.
    float line = width / (d + width);
    glow += pow(line, 2.5) * taper;
  }

  glow = clamp(glow, 0.0, 1.0);
  glow *= smoothstep(0.0, 0.12, uv.x) * smoothstep(1.0, 0.88, uv.x);

  gl_FragColor = vec4(uColor * glow, glow);
}
`;

/**
 * A fan of glowing filaments that ripple across the element and part around
 * the pointer.
 *
 * ```html
 * <ngb-threads class="absolute inset-0 -z-10" [amplitude]="1" mouseInteractive />
 * ```
 */
@Component({
  selector: 'ngb-threads',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbThreads extends NgbOglBackgroundBase {
  /** Thread colour. */
  readonly color = input('#ffffff');
  /** Wave height. */
  readonly amplitude = input(1, { transform: numberAttribute });
  /** Vertical spread of the fan, 0..1 of the element height. */
  readonly spread = input(0.55, { transform: numberAttribute });
  /** Thread thickness. */
  readonly thickness = input(0.004, { transform: numberAttribute });
  /** Animation speed. */
  readonly speed = input(1, { transform: numberAttribute });
  /** Part the threads around the pointer. */
  readonly mouseInteractive = input(false, { transform: booleanAttribute });
  /** Strength of the parting effect. */
  readonly mouseInfluence = input(1, { transform: numberAttribute });

  protected override trackPointer = true;
  protected readonly fragment = FRAGMENT;

  protected buildUniforms(): NgbUniforms {
    return {
      uMouse: { value: [0.5, 0.5] },
      uMouseInfluence: { value: 0 },
      uColor: { value: [1, 1, 1] },
      uAmplitude: { value: 1 },
      uSpread: { value: 0.55 },
      uThickness: { value: 0.004 },
      uSpeed: { value: 1 },
    };
  }

  protected override syncUniforms(): void {
    this.setUniform('uColor', toRgb(this.color()));
    this.setUniform('uAmplitude', this.amplitude());
    this.setUniform('uSpread', this.spread());
    this.setUniform('uThickness', this.thickness());
    this.setUniform('uSpeed', this.speed());
    this.setUniform('uMouseInfluence', this.mouseInteractive() ? this.mouseInfluence() : 0);
  }

  protected override update(): void {
    if (!this.mouseInteractive()) return;
    this.setUniform('uMouse', [this.pointer.sx, 1 - this.pointer.sy]);
  }
}
