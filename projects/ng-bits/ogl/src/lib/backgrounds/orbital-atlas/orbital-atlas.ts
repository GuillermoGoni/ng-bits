import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  input,
  numberAttribute,
} from '@angular/core';

import { NGB_BACKGROUND_STYLES } from '@guillermogoni/ng-bits';
import { toRgb, toRgbList } from '@guillermogoni/ng-bits';
import { NgbOglBackgroundBase, NgbUniforms } from '../../core/ogl-background-base';
import { NGB_CHUNK_COLOR, NGB_CHUNK_DITHER, NGB_CHUNK_UV } from '@guillermogoni/ng-bits';

/** Keep the fragment loop statically bounded for WebGL 1 drivers. */
const MAX_ORBITS = 7;

const FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform vec3 uBackground;
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform int uOrbitCount;
uniform float uSpeed;
uniform float uEccentricity;
uniform float uArcLength;
uniform float uLineWidth;
uniform float uGlow;
uniform float uMouseParallax;

varying vec2 vUv;

${NGB_CHUNK_UV}
${NGB_CHUNK_COLOR}
${NGB_CHUNK_DITHER}

const float TAU = 6.28318530718;

// Shortest distance between two positions on a looping 0..1 track.
float loopDistance(float a, float b) {
  return abs(fract(a - b + 0.5) - 0.5);
}

void main() {
  vec2 p = ngbAspectUv(vUv, uResolution);
  float time = uTime * uSpeed;

  // Keeping the focal point off-centre gives foreground copy a quiet area,
  // while the pointer only shifts it by a few percent of the composition.
  vec2 focus = vec2(-0.17, 0.015);
  focus += (uPointer - 0.5) * uMouseParallax;

  // All ellipses share a restrained tilt, then each gets a minute phase
  // offset. The result reads as a chart rather than a literal solar system.
  vec2 q = ngbRotate(-0.24) * (p - focus);
  vec3 light = vec3(0.0);

  for (int i = 0; i < ${MAX_ORBITS}; i++) {
    if (i >= uOrbitCount) break;

    float fi = float(i);
    float progress = uOrbitCount > 1 ? fi / float(uOrbitCount - 1) : 0.5;
    float seed = fi * 0.61803398875;

    // Wider rings grow more slowly, leaving an intentionally asymmetric
    // cluster instead of a concentric target.
    float rx = mix(0.24, 1.06, progress) + sin(seed * TAU) * 0.055;
    float ry = rx * (1.0 - uEccentricity * mix(0.56, 0.92, fract(seed * 1.7)));
    ry = max(ry, 0.08);

    vec2 normalized = vec2(q.x / rx, q.y / ry);
    float ellipseDistance = abs(length(normalized) - 1.0) * min(rx, ry);
    float angle = atan(normalized.y, normalized.x) / TAU + 0.5;

    // Each ring is a moving, partial arc. The satellite stays at its centre,
    // so it remains visually attached even with a short arc setting.
    float direction = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
    float arcCentre = fract(seed * 1.31 + direction * time * (0.036 + fi * 0.006));
    float halfArc = clamp(uArcLength, 0.08, 1.0) * 0.5;
    float arc = 1.0 - smoothstep(halfArc, halfArc + 0.035, loopDistance(angle, arcCentre));

    float width = uLineWidth * mix(1.05, 0.72, progress);
    float line = (1.0 - smoothstep(width * 0.18, width, ellipseDistance)) * arc;
    float halo = exp(-ellipseDistance / max(width * (3.5 + uGlow * 4.0), 0.0001)) * arc;

    float satelliteAngle = arcCentre * TAU;
    vec2 satellite = vec2(cos(satelliteAngle) * rx, sin(satelliteAngle) * ry);
    float satelliteDistance = length(q - satellite);
    float pin = exp(-satelliteDistance * satelliteDistance / max(width * width * 9.0, 0.000001));

    vec3 orbitColor = ngbRamp(uColor0, uColor1, uColor2, uColor2, 3, progress);
    light += orbitColor * (line * 0.92 + halo * (0.09 + uGlow * 0.06) + pin * (0.65 + uGlow * 0.16));
  }

  // A very soft focal bloom gives the atlas depth without introducing a
  // second visual object or reducing the contrast of text laid over it.
  float focusBloom = exp(-dot(q, q) * 2.7) * 0.055;
  vec3 color = uBackground + light + ngbRamp(uColor0, uColor1, uColor2, uColor2, 3, 0.42) * focusBloom;
  color += ngbDither(gl_FragCoord.xy) / 255.0;

  gl_FragColor = vec4(max(color, 0.0), 1.0);
}
`;

/**
 * Sparse, interrupted orbital arcs with tiny satellites moving along their
 * paths. It is a diagrammatic lighting study rather than a 3D scene, so it
 * remains quiet enough for hero copy and UI overlays.
 *
 * ```html
 * <ngb-orbital-atlas
 *   class="absolute inset-0 -z-10"
 *   [colors]="['#9dd6ff', '#b7a7ff', '#ff9fc9']"
 * />
 * ```
 */
@Component({
  selector: 'ngb-orbital-atlas',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbOrbitalAtlas extends NgbOglBackgroundBase {
  /** Colours distributed from the innermost to outermost orbit. */
  readonly colors = input<readonly string[]>(['#9dd6ff', '#b7a7ff', '#ff9fc9']);
  /** Opaque base behind the orbit drawing. */
  readonly backgroundColor = input('#080811');
  /** Number of visible orbital paths, clamped to 2..7. */
  readonly orbitCount = input(5, { transform: numberAttribute });
  /** Angular speed of the arcs and their satellites. */
  readonly speed = input(0.3, { transform: numberAttribute });
  /** Compression of the minor axis; 0 is circular. */
  readonly eccentricity = input(0.46, { transform: numberAttribute });
  /** Fraction of each elliptical path that is illuminated. */
  readonly arcLength = input(0.64, { transform: numberAttribute });
  /** Width of the sharp orbital stroke in screen-space units. */
  readonly lineWidth = input(0.004, { transform: numberAttribute });
  /** Soft light surrounding the strokes and satellites. */
  readonly glow = input(0.7, { transform: numberAttribute });
  /** Let the pointer make a restrained shift to the overall composition. */
  readonly mouseInteractive = input(true, { transform: booleanAttribute });
  /** Maximum pointer-driven shift of the focal point. */
  readonly mouseParallax = input(0.035, { transform: numberAttribute });

  protected override trackPointer = true;
  protected override pointerSmoothing = 0.055;
  protected readonly fragment = FRAGMENT;

  protected override rendererOptions() {
    return { alpha: false, antialias: false, depth: false };
  }

  protected buildUniforms(): NgbUniforms {
    return {
      uPointer: { value: [0.5, 0.5] },
      uBackground: { value: [0.03, 0.03, 0.07] },
      uColor0: { value: [0.62, 0.84, 1] },
      uColor1: { value: [0.72, 0.65, 1] },
      uColor2: { value: [1, 0.62, 0.79] },
      uOrbitCount: { value: 5 },
      uSpeed: { value: 0.3 },
      uEccentricity: { value: 0.46 },
      uArcLength: { value: 0.64 },
      uLineWidth: { value: 0.004 },
      uGlow: { value: 0.7 },
      uMouseParallax: { value: 0.035 },
    };
  }

  protected override syncUniforms(): void {
    const [color0, color1, color2] = toRgbList(this.colors(), 3, [1, 1, 1]);
    this.setUniform('uBackground', toRgb(this.backgroundColor(), [0.03, 0.03, 0.07]));
    this.setUniform('uColor0', color0);
    this.setUniform('uColor1', color1);
    this.setUniform('uColor2', color2);
    this.setUniform(
      'uOrbitCount',
      Math.max(2, Math.min(MAX_ORBITS, Math.round(this.orbitCount()))),
    );
    this.setUniform('uSpeed', Math.max(0, this.speed()));
    this.setUniform('uEccentricity', Math.max(0, Math.min(0.82, this.eccentricity())));
    this.setUniform('uArcLength', Math.max(0.08, Math.min(1, this.arcLength())));
    this.setUniform('uLineWidth', Math.max(0.0005, Math.min(0.03, this.lineWidth())));
    this.setUniform('uGlow', Math.max(0, Math.min(2, this.glow())));
    this.setUniform(
      'uMouseParallax',
      this.mouseInteractive() ? Math.max(0, Math.min(0.15, this.mouseParallax())) : 0,
    );
  }

  protected override update(): void {
    this.setUniform(
      'uPointer',
      this.mouseInteractive() ? [this.pointer.sx, 1 - this.pointer.sy] : [0.5, 0.5],
    );
  }
}
