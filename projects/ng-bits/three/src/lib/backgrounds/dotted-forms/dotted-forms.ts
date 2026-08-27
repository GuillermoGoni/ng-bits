import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  effect,
  input,
  numberAttribute,
} from '@angular/core';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from 'three';

import { NGB_BACKGROUND_STYLES, NgbBackgroundBase } from '@guillermogoni/ng-bits';
import { Rgb, toRgb, toRgbList } from '@guillermogoni/ng-bits';

export type NgbDottedFormShape = 'cube' | 'sphere' | 'torus' | 'octahedron';

const DEFAULT_COLORS = ['#E74C3C', '#F1C40F', '#2ECC71', '#3498DB', '#FFFFFF', '#F39C12'];

const VERTEX = /* glsl */ `
attribute vec3 color;

uniform float uPointSize;
uniform float uPixelRatio;

varying vec3 vColor;

void main() {
  vColor = color;
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewPosition;
  gl_PointSize = clamp(
    uPointSize * uPixelRatio * (3.2 / max(-viewPosition.z, 0.2)),
    1.0,
    32.0
  );
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;

uniform float uOpacity;

varying vec3 vColor;

void main() {
  float distanceToCenter = length(gl_PointCoord - 0.5);
  if (distanceToCenter > 0.5) discard;

  float coverage = 1.0 - smoothstep(0.34, 0.5, distanceToCenter);
  float core = 1.0 - smoothstep(0.0, 0.31, distanceToCenter);
  vec3 color = vColor * (0.78 + core * 0.38);
  gl_FragColor = vec4(color, coverage * uOpacity);
}
`;

interface PointBuffers {
  positions: number[];
  colors: number[];
}

function appendPoint(buffers: PointBuffers, position: readonly number[], color: Rgb): void {
  buffers.positions.push(position[0], position[1], position[2]);
  buffers.colors.push(color[0], color[1], color[2]);
}

function directionColor(x: number, y: number, z: number, palette: Rgb[]): Rgb {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const az = Math.abs(z);
  if (ax >= ay && ax >= az) return x >= 0 ? palette[0] : palette[1];
  if (ay >= az) return y >= 0 ? palette[2] : palette[3];
  return z >= 0 ? palette[4] : palette[5];
}

function cubePoints(density: number, palette: Rgb[]): PointBuffers {
  const buffers: PointBuffers = { positions: [], colors: [] };
  const last = density - 1;

  for (let x = 0; x < density; x++) {
    for (let y = 0; y < density; y++) {
      for (let z = 0; z < density; z++) {
        if (x !== 0 && x !== last && y !== 0 && y !== last && z !== 0 && z !== last) continue;

        const px = (x / last - 0.5) * 1.9;
        const py = (y / last - 0.5) * 1.9;
        const pz = (z / last - 0.5) * 1.9;
        appendPoint(buffers, [px, py, pz], directionColor(px, py, pz, palette));
      }
    }
  }

  return buffers;
}

function spherePoints(density: number, palette: Rgb[]): PointBuffers {
  const buffers: PointBuffers = { positions: [], colors: [] };
  const longitudeCount = density * 2;
  const radius = 1.08;

  appendPoint(buffers, [0, radius, 0], palette[2]);
  appendPoint(buffers, [0, -radius, 0], palette[3]);

  for (let latitude = 1; latitude < density; latitude++) {
    const polar = (latitude / density) * Math.PI;
    const ring = Math.sin(polar);
    const y = Math.cos(polar);

    for (let longitude = 0; longitude < longitudeCount; longitude++) {
      const azimuth = (longitude / longitudeCount) * Math.PI * 2;
      const x = Math.cos(azimuth) * ring;
      const z = Math.sin(azimuth) * ring;
      appendPoint(buffers, [x * radius, y * radius, z * radius], directionColor(x, y, z, palette));
    }
  }

  return buffers;
}

function torusPoints(density: number, palette: Rgb[]): PointBuffers {
  const buffers: PointBuffers = { positions: [], colors: [] };
  const ringCount = density * 2;
  const majorRadius = 0.73;
  const tubeRadius = 0.35;

  for (let ring = 0; ring < ringCount; ring++) {
    const u = (ring / ringCount) * Math.PI * 2;
    for (let side = 0; side < density; side++) {
      const v = (side / density) * Math.PI * 2;
      const radial = majorRadius + tubeRadius * Math.cos(v);
      const x = radial * Math.cos(u);
      const y = tubeRadius * Math.sin(v);
      const z = radial * Math.sin(u);
      const nx = Math.cos(u) * Math.cos(v);
      const ny = Math.sin(v);
      const nz = Math.sin(u) * Math.cos(v);
      appendPoint(buffers, [x, y, z], directionColor(nx, ny, nz, palette));
    }
  }

  return buffers;
}

function octahedronPoints(density: number, palette: Rgb[]): PointBuffers {
  const buffers: PointBuffers = { positions: [], colors: [] };
  const radius = 1.12;
  const signs = [-1, 1] as const;

  for (const sx of signs) {
    for (const sy of signs) {
      for (const sz of signs) {
        const faceColor = directionColor(sx, sy, sz, palette);
        for (let a = 0; a <= density; a++) {
          for (let b = 0; b <= density - a; b++) {
            const c = density - a - b;
            appendPoint(
              buffers,
              [
                (sx * a * radius) / density,
                (sy * b * radius) / density,
                (sz * c * radius) / density,
              ],
              faceColor,
            );
          }
        }
      }
    }
  }

  return buffers;
}

function createGeometry(
  shape: NgbDottedFormShape,
  density: number,
  palette: Rgb[],
): BufferGeometry {
  let buffers: PointBuffers;
  switch (shape) {
    case 'sphere':
      buffers = spherePoints(density, palette);
      break;
    case 'torus':
      buffers = torusPoints(density, palette);
      break;
    case 'octahedron':
      buffers = octahedronPoints(density, palette);
      break;
    default:
      buffers = cubePoints(density, palette);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(buffers.positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(buffers.colors), 3));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * A rotating point-shell study inspired by Guillermo Goñi's CodePen cube.
 * Switch between four forms while keeping the six directional face colours.
 *
 * ```html
 * <ngb-dotted-forms
 *   class="absolute inset-0 -z-10"
 *   shape="torus"
 *   [density]="24"
 * />
 * ```
 */
@Component({
  selector: 'ngb-dotted-forms',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbDottedForms extends NgbBackgroundBase {
  /** Point-shell primitive to render. */
  readonly shape = input<NgbDottedFormShape>('cube');
  /** Colours mapped to +x, -x, +y, -y, +z and -z respectively. */
  readonly colors = input<readonly string[]>(DEFAULT_COLORS);
  /** Samples along one edge or ring. */
  readonly density = input(22, { transform: numberAttribute });
  /** Apparent point diameter in CSS pixels near the centre of the scene. */
  readonly pointSize = input(8, { transform: numberAttribute });
  /** Overall form scale. */
  readonly scale = input(0.72, { transform: numberAttribute });
  /** Automatic rotation speed. */
  readonly speed = input(0.45, { transform: numberAttribute });
  /** Initial forward tilt in radians. */
  readonly tilt = input(0.5, { transform: numberAttribute });
  /** Let the pointer subtly turn the form without deforming it. */
  readonly mouseInteraction = input(true, { transform: booleanAttribute });
  /** Strength of pointer-driven rotation. */
  readonly mouseStrength = input(0.42, { transform: numberAttribute });
  /** Global point opacity. */
  readonly opacity = input(0.94, { transform: numberAttribute });
  /** Opaque colour behind the form. */
  readonly backgroundColor = input('#050508');

  protected override trackPointer = true;
  protected override pointerSmoothing = 0.07;

  private renderer!: WebGLRenderer;
  private scene!: Scene;
  private camera!: PerspectiveCamera;
  private points!: Points<BufferGeometry, ShaderMaterial>;
  private material!: ShaderMaterial;
  private geometrySignature = '';
  private spinX = 0;
  private spinY = 0;
  private spinZ = 0;
  private pointerX = 0;
  private pointerY = 0;

  constructor() {
    super();
    effect(() => {
      this.shape();
      this.colors();
      this.density();
      this.pointSize();
      this.scale();
      this.speed();
      this.tilt();
      this.mouseInteraction();
      this.mouseStrength();
      this.opacity();
      this.backgroundColor();
      if (this.renderer) {
        this.syncScene();
        this.requestFrame();
      }
    });
  }

  protected setup(canvas: HTMLCanvasElement): void {
    this.renderer = new WebGLRenderer({
      canvas,
      alpha: false,
      antialias: true,
      depth: true,
      stencil: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.viewWidth, this.viewHeight, false);

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(42, this.viewWidth / Math.max(this.viewHeight, 1), 0.1, 20);
    this.camera.position.set(0, 0, 3.7);
    this.camera.lookAt(0, 0, 0);

    this.material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uPointSize: { value: 8 },
        uPixelRatio: { value: this.pixelRatio },
        uOpacity: { value: 0.94 },
      },
      transparent: true,
      depthTest: true,
      depthWrite: true,
      toneMapped: false,
    });

    this.points = new Points(new BufferGeometry(), this.material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    this.geometrySignature = '';
    this.syncScene();
  }

  protected onResize(width: number, height: number, dpr: number): void {
    if (!this.renderer) return;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.material.uniforms['uPixelRatio'].value = dpr;
  }

  protected frame(_time: number, delta: number): void {
    if (!this.renderer || !this.points) return;

    const speed = Math.max(0, Math.min(3, this.speed()));
    this.spinX += delta * speed * 0.2;
    this.spinY += delta * speed * 0.43;
    this.spinZ += delta * speed * 0.055;

    const pointerActive = this.mouseInteraction() && this.pointer.inside;
    const strength = Math.max(0, Math.min(1.5, this.mouseStrength()));
    const targetX = pointerActive ? (0.5 - this.pointer.sy) * strength : 0;
    const targetY = pointerActive ? (this.pointer.sx - 0.5) * strength : 0;
    const smoothing = delta > 0 ? 1 - Math.exp(-delta * 7) : 1;
    this.pointerX += (targetX - this.pointerX) * smoothing;
    this.pointerY += (targetY - this.pointerY) * smoothing;

    this.points.rotation.set(
      this.tilt() + this.spinX + this.pointerX,
      this.spinY + this.pointerY,
      this.spinZ,
    );
    this.renderer.render(this.scene, this.camera);
  }

  protected teardown(): void {
    this.points?.geometry.dispose();
    this.material?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer = undefined!;
    this.scene = undefined!;
    this.camera = undefined!;
    this.points = undefined!;
    this.material = undefined!;
    this.geometrySignature = '';
  }

  private syncScene(): void {
    const density = Math.max(5, Math.min(36, Math.round(this.density())));
    const shape = this.normalizedShape(this.shape());
    const colors = this.colors();
    const signature = `${shape}|${density}|${colors.join('|')}`;

    if (signature !== this.geometrySignature) {
      const palette = toRgbList(colors, 6, [1, 1, 1]);
      const geometry = createGeometry(shape, density, palette);
      this.points.geometry.dispose();
      this.points.geometry = geometry;
      this.geometrySignature = signature;
    }

    const background = toRgb(this.backgroundColor(), [0.02, 0.02, 0.03]);
    this.renderer.setClearColor(new Color(background[0], background[1], background[2]), 1);
    this.material.uniforms['uPointSize'].value = Math.max(1, Math.min(24, this.pointSize()));
    this.material.uniforms['uOpacity'].value = Math.max(0, Math.min(1, this.opacity()));
    this.points.scale.setScalar(Math.max(0.25, Math.min(2, this.scale())));
  }

  private normalizedShape(shape: NgbDottedFormShape): NgbDottedFormShape {
    return shape === 'sphere' || shape === 'torus' || shape === 'octahedron' ? shape : 'cube';
  }
}
