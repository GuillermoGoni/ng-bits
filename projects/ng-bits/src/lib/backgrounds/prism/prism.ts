import { ChangeDetectionStrategy, Component, input, numberAttribute } from '@angular/core';

import { NGB_BACKGROUND_STYLES } from '../../core/background-base';
import { NgbOglBackgroundBase, NgbUniforms } from '../../core/ogl-background-base';
import { NGB_CHUNK_COLOR, NGB_CHUNK_NOISE2, NGB_CHUNK_UV } from '../../core/shader-chunks';

/** How the prism moves. */
export type NgbPrismAnimation = 'rotate' | 'hover' | '3drotate';

const FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uRotation;
uniform vec2 uOffset;
uniform float uScale;
uniform float uHeight;
uniform float uBaseWidth;
uniform float uGlow;
uniform float uBloom;
uniform float uHueShift;
uniform float uColorFrequency;
uniform float uNoise;

varying vec2 vUv;

${NGB_CHUNK_UV}
${NGB_CHUNK_NOISE2}
${NGB_CHUNK_COLOR}

mat3 rotY(float a) {
  float s = sin(a), c = cos(a);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}

mat3 rotX(float a) {
  float s = sin(a), c = cos(a);
  return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
}

// Square pyramid with a unit base, apex at height h. Exact distance.
float sdPyramid(vec3 p, float h) {
  float m2 = h * h + 0.25;

  p.xz = abs(p.xz);
  p.xz = (p.z > p.x) ? p.zx : p.xz;
  p.xz -= 0.5;

  vec3 q = vec3(p.z, h * p.y - 0.5 * p.x, h * p.x + 0.5 * p.y);

  float s = max(-q.x, 0.0);
  float t = clamp((q.y - 0.5 * p.z) / (m2 + 0.25), 0.0, 1.0);

  float a = m2 * (q.x + s) * (q.x + s) + q.y * q.y;
  float b = m2 * (q.x + 0.5 * t) * (q.x + 0.5 * t) + (q.y - m2 * t) * (q.y - m2 * t);

  float d2 = min(q.y, -q.x * m2 - q.y * 0.5) > 0.0 ? 0.0 : min(a, b);

  return sqrt((d2 + q.z * q.z) / m2) * sign(max(q.z, -p.y));
}

// The unit pyramid scaled to baseWidth and recentred on the origin.
float map(vec3 p) {
  float w = max(uBaseWidth, 0.001);
  vec3 q = p;
  q.y += uHeight * 0.5;
  return sdPyramid(q / w, uHeight / w) * w;
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.002, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)
  ));
}

// Spectrum sampled along the internal path — the prism's split light.
vec3 spectrum(float x) {
  return 0.5 + 0.5 * cos(6.28318 * (x + vec3(0.0, 0.33, 0.67)));
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);

  vec2 uv = vUv - 0.5 - uOffset;
  uv.x *= aspect;
  // Tuned so the default 3.5 x 5.5 pyramid fills the frame at scale 3.6.
  uv *= 15.0 / max(uScale, 0.001);

  // Orthographic. A pinhole camera close enough to frame a solid 5.5 units
  // deep magnifies its near base edge until it swallows the lower half of the
  // frame; the depth cues come from the refraction instead.
  vec3 ro = vec3(uv, 6.0);
  vec3 rd = vec3(0.0, 0.0, -1.0);

  // Tumble the solid, not the camera, so the framing stays put.
  mat3 spin = rotY(uRotation.x) * rotX(uRotation.y);
  mat3 inv = mat3(
    spin[0][0], spin[1][0], spin[2][0],
    spin[0][1], spin[1][1], spin[2][1],
    spin[0][2], spin[1][2], spin[2][2]
  );
  ro = inv * ro;
  rd = inv * rd;

  float dist = 0.0;
  float hit = 0.0;
  // Accumulated proximity to the surface: the edge bleed, for free.
  float halo = 0.0;

  for (int i = 0; i < 88; i++) {
    vec3 pos = ro + rd * dist;
    float d = map(pos);
    // Falls off fast, so only rays that graze the silhouette pick up bleed —
    // a slower falloff washes the whole frame at this framing.
    halo += 0.012 / (0.05 + d * d * 90.0);
    if (d < 0.0025) { hit = 1.0; break; }
    dist += max(d * 0.9, 0.004);
    if (dist > 14.0) break;
  }

  vec3 color = vec3(0.0);
  float alpha = 0.0;

  if (hit > 0.5) {
    vec3 pos = ro + rd * dist;
    vec3 n = calcNormal(pos);

    float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);

    // Bend the ray on entry, then integrate the spectrum along the chord.
    vec3 inner = refract(rd, n, 0.72);
    if (dot(inner, inner) < 0.0001) inner = reflect(rd, n);

    vec3 ip = pos + inner * 0.03;
    float travel = 0.0;
    vec3 glass = vec3(0.0);

    for (int j = 0; j < 44; j++) {
      if (map(ip) > 0.0) break;
      float band = uColorFrequency * (ip.y * 0.5 + travel * 0.32 + ip.x * 0.18);
      glass += spectrum(band) * 0.05;
      ip += inner * 0.07;
      travel += 0.07;
    }

    glass = ngbHueShift(glass, uHueShift);

    float spec = pow(max(dot(reflect(rd, n), normalize(vec3(0.3, 0.9, 0.4))), 0.0), 40.0);

    color = glass * (0.75 + 0.55 * fresnel) + fresnel * 0.30 + spec * 0.5;
    alpha = clamp(0.30 + fresnel * 0.85 + max(max(glass.r, glass.g), glass.b) * 0.7, 0.0, 1.0);
  }

  // Edge glow and bloom, both driven by the same proximity integral.
  float bleed = clamp(halo * 0.06, 0.0, 2.0);
  vec3 glowColor = ngbHueShift(spectrum(halo * 0.12 + uHueShift * 0.15), uHueShift);
  color += glowColor * bleed * uGlow * 0.55;
  color += glowColor * bleed * bleed * uBloom * 0.10;
  alpha = clamp(alpha + bleed * (uGlow * 0.35 + uBloom * 0.08), 0.0, 1.0);

  if (uNoise > 0.0) {
    color += ngbNoise(gl_FragCoord.xy * 1.7 + uTime * 40.0) * uNoise * 0.12;
  }

  gl_FragColor = vec4(color * alpha, alpha);
}
`;

const TAU = Math.PI * 2;

/**
 * A translucent glass pyramid raymarched in place. The primary ray is
 * refracted on entry and integrated along the chord inside the solid, so the
 * body fills with split-spectrum bands instead of a flat surface tint.
 *
 * ```html
 * <ngb-prism class="absolute inset-0 -z-10" [scale]="3.6" [glow]="1" animation="rotate" />
 * ```
 */
@Component({
  selector: 'ngb-prism',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbPrism extends NgbOglBackgroundBase {
  /** `rotate` wobbles, `3drotate` tumbles, `hover` follows the pointer. */
  readonly animation = input<NgbPrismAnimation>('rotate');
  /** Apex height, in world units. */
  readonly height = input(3.5, { transform: numberAttribute });
  /** Base width across X and Z, in world units. */
  readonly baseWidth = input(5.5, { transform: numberAttribute });
  /** Screen-space size. Bigger fills more of the element. */
  readonly scale = input(3.6, { transform: numberAttribute });
  /** Global time multiplier. 0 freezes the animation. */
  readonly timeScale = input(0.5, { transform: numberAttribute });
  /** Edge glow intensity. */
  readonly glow = input(1, { transform: numberAttribute });
  /** Extra bloom layered on top of the glow. */
  readonly bloom = input(1, { transform: numberAttribute });
  /** Hue rotation applied to the whole image, in radians. */
  readonly hueShift = input(0, { transform: numberAttribute });
  /** Frequency of the internal spectrum bands. */
  readonly colorFrequency = input(1, { transform: numberAttribute });
  /** Film grain added to the final colour. 0 disables it. */
  readonly noise = input(0, { transform: numberAttribute });
  /** Horizontal offset, as a fraction of the element width. */
  readonly offsetX = input(0, { transform: numberAttribute });
  /** Vertical offset, as a fraction of the element height. Positive is down. */
  readonly offsetY = input(0, { transform: numberAttribute });
  /** Pointer tilt sensitivity, used by the `hover` animation. */
  readonly hoverStrength = input(1, { transform: numberAttribute });
  /** Hover easing, 0..1. Higher is snappier. */
  readonly inertia = input(0.08, { transform: numberAttribute });

  protected override trackPointer = true;
  protected readonly fragment = FRAGMENT;

  /** Integrated so switching animation mode eases instead of jumping. */
  private yaw = 0;
  private pitch = 0;

  protected buildUniforms(): NgbUniforms {
    return {
      uRotation: { value: [0, 0] },
      uOffset: { value: [0, 0] },
      uScale: { value: 3.6 },
      uHeight: { value: 3.5 },
      uBaseWidth: { value: 5.5 },
      uGlow: { value: 1 },
      uBloom: { value: 1 },
      uHueShift: { value: 0 },
      uColorFrequency: { value: 1 },
      uNoise: { value: 0 },
    };
  }

  protected override syncUniforms(): void {
    this.setUniform('uScale', this.scale());
    this.setUniform('uHeight', this.height());
    this.setUniform('uBaseWidth', this.baseWidth());
    this.setUniform('uGlow', this.glow());
    this.setUniform('uBloom', this.bloom());
    this.setUniform('uHueShift', this.hueShift());
    this.setUniform('uColorFrequency', this.colorFrequency());
    this.setUniform('uNoise', this.noise());
    this.setUniform('uOffset', [this.offsetX(), -this.offsetY()]);
  }

  protected override update(_time: number, delta: number): void {
    const dt = delta * this.timeScale();

    switch (this.animation()) {
      case '3drotate':
        this.yaw = (this.yaw + dt * 0.7) % TAU;
        this.pitch = (this.pitch + dt * 0.43) % TAU;
        break;

      case 'hover': {
        // Ease towards the pointer so the tilt has weight.
        const k = Math.min(1, Math.max(0, this.inertia()));
        const strength = this.hoverStrength();
        const targetYaw = (this.pointer.sx - 0.5) * 1.6 * strength;
        const targetPitch = (this.pointer.sy - 0.5) * 1.0 * strength;
        this.yaw += (targetYaw - this.yaw) * k;
        this.pitch += (targetPitch - this.pitch) * k;
        break;
      }

      default:
        this.yaw = (this.yaw + dt * 0.55) % TAU;
        this.pitch = Math.sin(this.time * this.timeScale() * 0.4) * 0.22;
        break;
    }

    this.setUniform('uRotation', [this.yaw, this.pitch]);
  }
}
