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
import { NGB_CHUNK_DITHER, NGB_CHUNK_UV } from '@guillermogoni/ng-bits';

const FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uBackground;
uniform float uCellScale;
uniform float uSpeed;
uniform float uEdgeWidth;
uniform float uRefraction;
uniform float uGlow;
uniform float uMouseStrength;
uniform float uMouseAmount;
uniform float uOpacity;

varying vec2 vUv;

${NGB_CHUNK_UV}
${NGB_CHUNK_DITHER}

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec2 hash22(vec2 p) {
  return fract(sin(vec2(
    dot(p, vec2(127.1, 311.7)),
    dot(p, vec2(269.5, 183.3))
  )) * 43758.5453123);
}

vec3 palette(float t) {
  return t < 0.5
    ? mix(uColor0, uColor1, smoothstep(0.0, 0.5, t))
    : mix(uColor1, uColor2, smoothstep(0.5, 1.0, t));
}

void voronoi(vec2 position, out float firstDistance, out float secondDistance, out vec2 nearest, out vec2 cellId) {
  vec2 baseCell = floor(position);
  vec2 local = fract(position);
  firstDistance = 10.0;
  secondDistance = 10.0;
  nearest = vec2(0.0);
  cellId = baseCell;

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbour = vec2(float(x), float(y));
      vec2 random = hash22(baseCell + neighbour);
      float phase = uTime * uSpeed + 6.2831853 * random.x;
      vec2 site = neighbour + 0.5 + 0.31 * sin(phase + 6.2831853 * random);
      vec2 difference = site - local;
      float distanceSquared = dot(difference, difference);

      if (distanceSquared < firstDistance) {
        secondDistance = firstDistance;
        firstDistance = distanceSquared;
        nearest = difference;
        cellId = baseCell + neighbour;
      } else if (distanceSquared < secondDistance) {
        secondDistance = distanceSquared;
      }
    }
  }
}

void main() {
  vec2 position = ngbAspectUv(vUv, uResolution) * uCellScale;
  vec2 mouse = uPointer - 0.5;
  mouse.x *= uResolution.x / max(uResolution.y, 1.0);
  mouse *= uCellScale;

  vec2 fromMouse = position - mouse;
  float mouseDistance = length(fromMouse);
  float lens = exp(-mouseDistance * mouseDistance * 0.38) * uMouseStrength * uMouseAmount;
  position += fromMouse / max(mouseDistance, 0.001) * lens * 0.34;

  float firstDistance;
  float secondDistance;
  vec2 nearest;
  vec2 cellId;
  voronoi(position, firstDistance, secondDistance, nearest, cellId);

  float distanceToSite = sqrt(firstDistance);
  float borderDistance = max(sqrt(secondDistance) - distanceToSite, 0.0);
  float edgeSoftness = 0.012 + 0.006 / max(uCellScale, 1.0);
  float edge = 1.0 - smoothstep(uEdgeWidth, uEdgeWidth + edgeSoftness, borderDistance);
  float fineEdge = 1.0 - smoothstep(uEdgeWidth * 0.34, uEdgeWidth * 0.34 + edgeSoftness, borderDistance);

  float cellRandom = hash21(cellId);
  vec3 cellColor = palette(cellRandom);
  vec2 normal = normalize(nearest + vec2(0.0001));
  vec2 lightDirection = normalize(vec2(
    cos(uTime * uSpeed * 0.62 + 0.4),
    sin(uTime * uSpeed * 0.47 + 1.1)
  ));
  float glint = pow(max(dot(normal, lightDirection), 0.0), 10.0);
  float facet = pow(clamp(1.0 - distanceToSite * 0.78, 0.0, 1.0), 2.2);

  float angle = atan(nearest.y, nearest.x) / 6.2831853;
  vec3 spectrum = 0.58 + 0.42 * cos(6.2831853 * (angle + vec3(0.0, 0.19, 0.38)));
  spectrum *= palette(fract(cellRandom + 0.24));
  vec3 edgeColor = mix(cellColor, spectrum, uRefraction);

  vec3 glass = mix(uBackground, cellColor, 0.055 + facet * 0.055);
  glass += cellColor * glint * facet * 0.13;
  glass += edgeColor * edge * (0.26 + uGlow * 0.46 + glint * 0.5);
  glass += vec3(1.0) * fineEdge * fineEdge * uGlow * (0.09 + glint * 0.22);
  glass += ngbDither(gl_FragCoord.xy + vec2(uTime * 11.0, 0.0)) / 255.0;

  vec3 color = mix(uBackground, glass, uOpacity);
  gl_FragColor = vec4(max(color, 0.0), 1.0);
}
`;

/**
 * Animated dark-glass Voronoi cells with refracted spectral edges. Pointer
 * movement acts like a gentle lens without breaking cell continuity.
 *
 * ```html
 * <ngb-prismatic-cells
 *   class="absolute inset-0 -z-10"
 *   [colors]="['#7C5CFF', '#38D7FF', '#FF6EDB']"
 * />
 * ```
 */
@Component({
  selector: 'ngb-prismatic-cells',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbPrismaticCells extends NgbOglBackgroundBase {
  /** Three-stop palette used by the glass and its refracted borders. */
  readonly colors = input<readonly string[]>(['#7C5CFF', '#38D7FF', '#FF6EDB']);
  /** Opaque colour below the glass cells. */
  readonly backgroundColor = input('#05040B');
  /** Number of cells across the short axis. */
  readonly cellScale = input(8, { transform: numberAttribute });
  /** Drift speed of the cell sites and highlight. */
  readonly speed = input(0.32, { transform: numberAttribute });
  /** Thickness of the illuminated cell boundaries. */
  readonly edgeWidth = input(0.075, { transform: numberAttribute });
  /** Amount of RGB separation along the boundaries. */
  readonly refraction = input(0.78, { transform: numberAttribute });
  /** Brightness of the spectral outlines. */
  readonly glow = input(0.85, { transform: numberAttribute });
  /** Let the pointer bend the cell field like a lens. */
  readonly mouseInteraction = input(true, { transform: booleanAttribute });
  /** Strength of pointer-driven lensing. */
  readonly mouseStrength = input(0.72, { transform: numberAttribute });
  /** Blend between the background colour and the full effect. */
  readonly opacity = input(1, { transform: numberAttribute });

  protected override trackPointer = true;
  protected override pointerSmoothing = 0.055;
  protected readonly fragment = FRAGMENT;

  private mouseAmount = 0;

  protected override rendererOptions() {
    return { alpha: false, antialias: false, depth: false };
  }

  protected buildUniforms(): NgbUniforms {
    return {
      uPointer: { value: [0.5, 0.5] },
      uColor0: { value: [0.49, 0.36, 1] },
      uColor1: { value: [0.22, 0.84, 1] },
      uColor2: { value: [1, 0.43, 0.86] },
      uBackground: { value: [0.02, 0.016, 0.043] },
      uCellScale: { value: 8 },
      uSpeed: { value: 0.32 },
      uEdgeWidth: { value: 0.075 },
      uRefraction: { value: 0.78 },
      uGlow: { value: 0.85 },
      uMouseStrength: { value: 0.72 },
      uMouseAmount: { value: 0 },
      uOpacity: { value: 1 },
    };
  }

  protected override syncUniforms(): void {
    const colors = toRgbList(this.colors(), 3, [1, 1, 1]);
    this.setUniform('uColor0', colors[0]);
    this.setUniform('uColor1', colors[1]);
    this.setUniform('uColor2', colors[2]);
    this.setUniform('uBackground', toRgb(this.backgroundColor(), [0.02, 0.016, 0.043]));
    this.setUniform('uCellScale', Math.max(2, Math.min(20, this.cellScale())));
    this.setUniform('uSpeed', Math.max(0, Math.min(3, this.speed())));
    this.setUniform('uEdgeWidth', Math.max(0.005, Math.min(0.28, this.edgeWidth())));
    this.setUniform('uRefraction', Math.max(0, Math.min(1.5, this.refraction())));
    this.setUniform('uGlow', Math.max(0, Math.min(3, this.glow())));
    this.setUniform(
      'uMouseStrength',
      this.mouseInteraction() ? Math.max(0, Math.min(2, this.mouseStrength())) : 0,
    );
    this.setUniform('uOpacity', Math.max(0, Math.min(1, this.opacity())));
  }

  protected override update(_time: number, delta: number): void {
    const enabled = this.mouseInteraction();
    const target = enabled && this.pointer.inside ? 1 : 0;
    const smoothing = delta > 0 ? 1 - Math.exp(-delta * 8) : 1;
    this.mouseAmount += (target - this.mouseAmount) * smoothing;

    if (enabled) this.setUniform('uPointer', [this.pointer.sx, 1 - this.pointer.sy]);
    this.setUniform('uMouseAmount', this.mouseAmount);
  }
}
