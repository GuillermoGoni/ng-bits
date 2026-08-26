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
import { NGB_CHUNK_DITHER, NGB_CHUNK_NOISE2, NGB_CHUNK_UV } from '../../core/shader-chunks';

export type NgbGradientWavesDetail = 'low' | 'medium' | 'high';

const DETAIL_STEPS: Record<NgbGradientWavesDetail, number> = {
  low: 40,
  medium: 64,
  high: 88,
};

const FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform vec3 uHorizonColor;
uniform vec3 uWaveColor;
uniform vec3 uCrestColor;
uniform float uSpeed;
uniform float uAmplitude;
uniform float uWaveScale;
uniform float uWaveRatio;
uniform float uSwell;
uniform float uTurbulence;
uniform float uTilt;
uniform float uZoom;
uniform float uHeight;
uniform float uFogDepth;
uniform float uDetailSteps;
uniform float uBrightness;
uniform float uOpacity;
uniform float uParallaxStrength;
uniform float uGrainIntensity;

varying vec2 vUv;

${NGB_CHUNK_UV}
${NGB_CHUNK_NOISE2}
${NGB_CHUNK_DITHER}

float waveHeight(vec2 position) {
  float scale = max(uWaveScale, 0.05);
  float time = uTime * uSpeed;
  vec2 p = position * scale;

  float shortWave = sin(p.x * 2.15 + p.y * 1.08 + time * 1.3);
  float longWave = sin(p.x * 0.82 - p.y * 0.56 - time * 0.72);
  float crossWave = sin(p.x * 1.24 + p.y * 0.31 + time * 0.48);
  float waves = shortWave * 0.52 + longWave * 0.34 * uWaveRatio + crossWave * 0.14;

  float swell = sin(position.y * 0.17 + position.x * 0.11 + time * 0.28);
  swell *= uSwell / 35.0;

  vec2 noisePosition = position * scale * 0.22 + vec2(time * 0.12, -time * 0.08);
  float turbulence = ngbFbm(noisePosition, 4) * (uTurbulence / 20.0);

  return waves * uAmplitude * 0.18 + swell * 0.24 + turbulence * 0.38;
}

vec3 waveNormal(vec2 position) {
  float epsilon = 0.035;
  float left = waveHeight(position - vec2(epsilon, 0.0));
  float right = waveHeight(position + vec2(epsilon, 0.0));
  float back = waveHeight(position - vec2(0.0, epsilon));
  float front = waveHeight(position + vec2(0.0, epsilon));
  return normalize(vec3(left - right, 2.0 * epsilon, back - front));
}

void main() {
  vec2 screen = ngbAspectUv(vUv, uResolution) * 2.0;
  vec2 parallax = (uPointer - 0.5) * uParallaxStrength;

  vec3 rayOrigin = vec3(parallax.x * 1.8, max(uHeight, 0.1) * 0.25, -3.2 + parallax.y);
  vec3 forward = normalize(vec3(parallax.x * 0.08, -cos(uTilt), sin(uTilt)));
  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  vec3 up = normalize(cross(right, forward));
  vec3 rayDirection = normalize(
    forward + right * screen.x / max(uZoom * 1.22, 0.05) + up * screen.y / max(uZoom * 1.22, 0.05)
  );

  float maxDistance = max(uFogDepth, 1.0) * 1.35;
  float minimumStep = maxDistance / max(uDetailSteps, 1.0);
  float travel = 0.0;
  float hit = 0.0;
  vec3 position = rayOrigin;

  // Linear/adaptive height-field march. The static upper bound keeps it valid
  // on WebGL 1 while the detail tier stops the loop sooner on lighter modes.
  for (int i = 0; i < 88; i++) {
    if (float(i) >= uDetailSteps) break;

    position = rayOrigin + rayDirection * travel;
    float distanceToSurface = position.y - waveHeight(position.xz);
    if (distanceToSurface < 0.012) {
      hit = 1.0;
      break;
    }

    travel += clamp(distanceToSurface * 0.34, minimumStep * 0.36, minimumStep * 1.08);
    if (travel > maxDistance) break;
  }

  float horizonLine = 1.0 - smoothstep(0.15, 0.9, abs(screen.y - 0.48));
  vec3 color = uHorizonColor * (0.055 + horizonLine * 0.24);
  float alpha = (0.08 + horizonLine * 0.24) * uOpacity;

  if (hit > 0.5) {
    vec3 normal = waveNormal(position.xz);
    vec3 lightDirection = normalize(vec3(-0.35, 0.86, -0.38));
    float diffuse = max(dot(normal, lightDirection), 0.0);
    float surfaceHeight = waveHeight(position.xz);
    float crest = smoothstep(0.06, 0.68, surfaceHeight) * pow(diffuse, 1.6);

    float fog = smoothstep(0.0, max(uFogDepth, 0.001), travel);
    vec3 body = mix(uWaveColor * (0.46 + diffuse * 0.38), uCrestColor, crest * 0.46);
    color = mix(body, uHorizonColor, fog * fog);
    alpha = mix(1.0, 0.12, fog) * uOpacity;
  }

  float grain = uGrainIntensity > 0.0
    ? ngbDither(gl_FragCoord.xy + vec2(uTime * 37.0, uTime * 19.0)) * uGrainIntensity
    : ngbDither(gl_FragCoord.xy) / 255.0;
  color = max(color * uBrightness + grain, 0.0);

  gl_FragColor = vec4(color * alpha, clamp(alpha, 0.0, 1.0));
}
`;

/**
 * A perspective field of rolling gradient waves. The nearest crests catch a
 * bright highlight while distance dissolves the surface into coloured haze.
 *
 * ```html
 * <ngb-gradient-waves
 *   class="absolute inset-0 -z-10"
 *   horizonColor="#5227FF"
 *   waveColor="#FF9FFC"
 * />
 * ```
 */
@Component({
  selector: 'ngb-gradient-waves',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbGradientWaves extends NgbOglBackgroundBase {
  /** Distant haze colour the waves fade into. */
  readonly horizonColor = input('#5227FF');
  /** Mid colour of the rolling wave bodies. */
  readonly waveColor = input('#FF9FFC');
  /** Highlight colour of the nearest crests. */
  readonly crestColor = input('#FFFFFF');
  /** Animation speed of the wave field. */
  readonly speed = input(0.4, { transform: numberAttribute });
  /** Height of the short wave components. */
  readonly amplitude = input(2.5, { transform: numberAttribute });
  /** Overall spatial frequency of the waves. */
  readonly waveScale = input(0.6, { transform: numberAttribute });
  /** Balance of the long wavelength component. */
  readonly waveRatio = input(0.9, { transform: numberAttribute });
  /** Strength of the broad horizontal swell. */
  readonly swell = input(35, { transform: numberAttribute });
  /** Strength of the cross-flow noise. */
  readonly turbulence = input(20, { transform: numberAttribute });
  /** Camera pitch toward the horizon, in radians. */
  readonly tilt = input(1.11, { transform: numberAttribute });
  /** Field-of-view zoom into the wave field. */
  readonly zoom = input(1, { transform: numberAttribute });
  /** Vertical camera height above the field. */
  readonly height = input(5.5, { transform: numberAttribute });
  /** Distance over which waves dissolve into haze. */
  readonly fogDepth = input(15, { transform: numberAttribute });
  /** Raymarch quality tier. */
  readonly detail = input<NgbGradientWavesDetail>('medium');
  /** Overall colour brightness. */
  readonly brightness = input(1, { transform: numberAttribute });
  /** Global opacity of the effect. */
  readonly opacity = input(1, { transform: numberAttribute });
  /** Let the pointer subtly shift the camera. */
  readonly mouseInteraction = input(true, { transform: booleanAttribute });
  /** Strength of pointer-driven camera drift. */
  readonly parallaxStrength = input(0.5, { transform: numberAttribute });
  /** Add a subtle animated grain layer. */
  readonly grain = input(true, { transform: booleanAttribute });
  /** Amplitude of the animated grain. */
  readonly grainIntensity = input(0.05, { transform: numberAttribute });

  protected override trackPointer = true;
  protected override pointerSmoothing = 0.045;
  protected readonly fragment = FRAGMENT;

  protected buildUniforms(): NgbUniforms {
    return {
      uPointer: { value: [0.5, 0.5] },
      uHorizonColor: { value: [0.32, 0.15, 1] },
      uWaveColor: { value: [1, 0.62, 0.99] },
      uCrestColor: { value: [1, 1, 1] },
      uSpeed: { value: 0.4 },
      uAmplitude: { value: 2.5 },
      uWaveScale: { value: 0.6 },
      uWaveRatio: { value: 0.9 },
      uSwell: { value: 35 },
      uTurbulence: { value: 20 },
      uTilt: { value: 1.11 },
      uZoom: { value: 1 },
      uHeight: { value: 5.5 },
      uFogDepth: { value: 15 },
      uDetailSteps: { value: DETAIL_STEPS.medium },
      uBrightness: { value: 1 },
      uOpacity: { value: 1 },
      uParallaxStrength: { value: 0.5 },
      uGrainIntensity: { value: 0.05 },
    };
  }

  protected override syncUniforms(): void {
    this.setUniform('uHorizonColor', toRgb(this.horizonColor(), [0.32, 0.15, 1]));
    this.setUniform('uWaveColor', toRgb(this.waveColor(), [1, 0.62, 0.99]));
    this.setUniform('uCrestColor', toRgb(this.crestColor(), [1, 1, 1]));
    this.setUniform('uSpeed', Math.max(0, Math.min(3, this.speed())));
    this.setUniform('uAmplitude', Math.max(0, Math.min(6, this.amplitude())));
    this.setUniform('uWaveScale', Math.max(0.05, Math.min(2, this.waveScale())));
    this.setUniform('uWaveRatio', Math.max(0, Math.min(2, this.waveRatio())));
    this.setUniform('uSwell', Math.max(0, Math.min(80, this.swell())));
    this.setUniform('uTurbulence', Math.max(0, Math.min(60, this.turbulence())));
    this.setUniform('uTilt', Math.max(0.35, Math.min(1.48, this.tilt())));
    this.setUniform('uZoom', Math.max(0.35, Math.min(2.5, this.zoom())));
    this.setUniform('uHeight', Math.max(1, Math.min(10, this.height())));
    this.setUniform('uFogDepth', Math.max(3, Math.min(30, this.fogDepth())));
    this.setUniform('uDetailSteps', DETAIL_STEPS[this.detail()] ?? DETAIL_STEPS.medium);
    this.setUniform('uBrightness', Math.max(0, Math.min(3, this.brightness())));
    this.setUniform('uOpacity', Math.max(0, Math.min(1, this.opacity())));
    this.setUniform(
      'uParallaxStrength',
      this.mouseInteraction() ? Math.max(0, Math.min(2, this.parallaxStrength())) : 0,
    );
    this.setUniform(
      'uGrainIntensity',
      this.grain() ? Math.max(0, Math.min(0.25, this.grainIntensity())) : 0,
    );
  }

  protected override update(): void {
    if (!this.mouseInteraction()) return;
    this.setUniform('uPointer', [this.pointer.sx, 1 - this.pointer.sy]);
  }
}
