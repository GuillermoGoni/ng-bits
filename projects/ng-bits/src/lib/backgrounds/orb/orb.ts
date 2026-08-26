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
uniform float uHue;
uniform float uHover;
uniform float uHoverIntensity;
uniform float uRotation;
uniform vec3 uBackground;

varying vec2 vUv;

${NGB_CHUNK_UV}
${NGB_CHUNK_NOISE2}
${NGB_CHUNK_COLOR}
${NGB_CHUNK_DITHER}

const float PI = 3.14159265359;
void main() {
  vec2 p = ngbAspectUv(vUv, uResolution) * 2.0;
  float radius = length(p);
  float time = uTime * 0.24 + uRotation;

  float hoverEnergy = uHover * uHoverIntensity;
  // Keep a single exact silhouette. All luminous layers below are sampled
  // from this same signed distance, so hover can never split the rim.
  float signedDistance = radius - 0.67;
  float rimDistance = abs(signedDistance);

  // A cool lower rim, violet sides and a narrow white crest at the upper
  // right reproduce the glassy, back-lit reading without a 3D mesh.
  float directional = pow(max(dot(normalize(p + vec2(0.0001)), normalize(vec2(0.55, 0.84))), 0.0), 7.0);
  float lowerArc = 1.0 - smoothstep(-0.95, -0.15, p.y / max(radius, 0.001));
  vec3 violet = vec3(0.48, 0.18, 1.0);
  vec3 blue = vec3(0.18, 0.62, 1.0);
  vec3 rimColor = mix(violet, blue, smoothstep(-0.45, 0.75, p.y / max(radius, 0.001)));
  rimColor = mix(rimColor, vec3(1.0), directional * 0.9);
  rimColor = ngbHueShift(rimColor, uHue * PI / 180.0);

  float sharpRim = exp(-rimDistance * 92.0);
  float glow = exp(-rimDistance * 18.0) * 0.42;
  float outerHalo = exp(-max(signedDistance, 0.0) * 18.0) * step(0.0, signedDistance);

  // The dormant centre is nearly black. Hover reveals slow folded wisps that
  // appear to sit behind the illuminated shell.
  float inside = 1.0 - smoothstep(-0.02, 0.035, signedDistance);
  vec2 innerUv = ngbRotate(time * 0.28) * p;
  float innerA = ngbFbm(innerUv * 2.4 + vec2(time * 0.6, -time * 0.35), 4);
  float innerB = ngbFbm(innerUv * 5.2 - vec2(time * 0.42, time * 0.3), 3);
  float foldedLight = 0.5 + 0.5 * sin((innerA + innerB * 0.62) * 9.0 + time);
  float filaments = smoothstep(0.42, 0.82, foldedLight);
  // The reveal is a Cartesian noise field, so it crosses the origin without
  // converging into a radial pin-light or leaving a circular hole behind.
  float reveal = clamp(hoverEnergy * 0.9, 0.0, 1.0) * inside;
  vec3 innerColor = ngbHueShift(mix(violet, blue, innerA * 0.5 + 0.5), uHue * PI / 180.0);

  vec3 color = uBackground;
  color += innerColor * (0.08 + filaments * 0.62) * reveal * 0.68;
  color += rimColor * (sharpRim * (0.78 + directional * 1.65) + glow + outerHalo * 0.08);
  color += ngbHueShift(violet, uHue * PI / 180.0) * lowerArc * glow * 0.28;
  color += ngbDither(gl_FragCoord.xy) / 255.0;

  gl_FragColor = vec4(max(color, 0.0), 1.0);
}
`;

/**
 * A luminous glass-like orb with a cool spectral rim. Hovering reveals folded
 * colour inside the shell while the circular silhouette remains stable.
 *
 * ```html
 * <ngb-orb class="absolute inset-0 -z-10" [hoverIntensity]="0.6" rotateOnHover />
 * ```
 */
@Component({
  selector: 'ngb-orb',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbOrb extends NgbOglBackgroundBase {
  /** Base hue shift in degrees. */
  readonly hue = input(0, { transform: numberAttribute });
  /** Strength of the interior reveal while hovered. */
  readonly hoverIntensity = input(0.2, { transform: numberAttribute });
  /** Let the spectral rim rotate while the pointer is over the orb. */
  readonly rotateOnHover = input(true, { transform: booleanAttribute });
  /** Keep the hover treatment active without requiring a pointer. */
  readonly forceHoverState = input(false, { transform: booleanAttribute });
  /** Opaque colour painted behind the orb. */
  readonly backgroundColor = input('#000000');

  protected override trackPointer = true;
  protected override pointerSmoothing = 0.055;
  protected readonly fragment = FRAGMENT;

  private hoverAmount = 0;
  private rotation = 0;

  protected override rendererOptions() {
    return { alpha: false, antialias: false, depth: false };
  }

  protected buildUniforms(): NgbUniforms {
    return {
      uHue: { value: 0 },
      uHover: { value: 0 },
      uHoverIntensity: { value: 0.2 },
      uRotation: { value: 0 },
      uBackground: { value: [0, 0, 0] },
    };
  }

  protected override syncUniforms(): void {
    this.setUniform('uHue', this.hue());
    this.setUniform('uHoverIntensity', Math.max(0, Math.min(3, this.hoverIntensity())));
    this.setUniform('uBackground', toRgb(this.backgroundColor(), [0, 0, 0]));
  }

  protected override update(_time: number, delta: number): void {
    const target = this.forceHoverState() || this.pointer.inside ? 1 : 0;
    if (delta === 0) {
      // Static/reduced-motion frames should still honour a forced state.
      this.hoverAmount = target;
    } else {
      const smoothing = 1 - Math.exp(-delta * 8);
      this.hoverAmount += (target - this.hoverAmount) * smoothing;
    }

    if (this.rotateOnHover()) this.rotation += delta * this.hoverAmount * 0.72;

    this.setUniform('uHover', this.hoverAmount);
    this.setUniform('uRotation', this.rotation);
  }
}
