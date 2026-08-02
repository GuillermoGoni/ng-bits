import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  effect,
  input,
  numberAttribute,
} from '@angular/core';
import {
  ClampToEdgeWrapping,
  HalfFloatType,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';

import { NGB_BACKGROUND_STYLES, NgbBackgroundBase } from '../../core/background-base';
import { Rgb, toRgb } from '../../core/color';

/** A render target pair that can be swapped after each write. */
interface DoubleTarget {
  read: WebGLRenderTarget;
  write: WebGLRenderTarget;
}

const BASE_VERTEX = /* glsl */ `
uniform vec2 uTexelSize;

varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;

void main() {
  vUv = uv;
  vL = vUv - vec2(uTexelSize.x, 0.0);
  vR = vUv + vec2(uTexelSize.x, 0.0);
  vT = vUv + vec2(0.0, uTexelSize.y);
  vB = vUv - vec2(0.0, uTexelSize.y);
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** Semi-Lagrangian advection: trace the velocity field backwards in time. */
const ADVECTION_FRAGMENT = /* glsl */ `
precision highp float;
precision highp sampler2D;

uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uSourceTexelSize;
uniform float uDt;
uniform float uDissipation;

varying vec2 vUv;

void main() {
  vec2 coord = vUv - uDt * texture2D(uVelocity, vUv).xy * uSourceTexelSize;
  gl_FragColor = texture2D(uSource, coord) / (1.0 + uDissipation * uDt);
}
`;

const DIVERGENCE_FRAGMENT = /* glsl */ `
precision highp float;
precision highp sampler2D;

uniform sampler2D uVelocity;

varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;

void main() {
  float L = texture2D(uVelocity, vL).x;
  float R = texture2D(uVelocity, vR).x;
  float T = texture2D(uVelocity, vT).y;
  float B = texture2D(uVelocity, vB).y;

  // Reflect at the borders so the fluid does not leak off the edges.
  vec2 C = texture2D(uVelocity, vUv).xy;
  if (vL.x < 0.0) L = -C.x;
  if (vR.x > 1.0) R = -C.x;
  if (vT.y > 1.0) T = -C.y;
  if (vB.y < 0.0) B = -C.y;

  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}
`;

const CURL_FRAGMENT = /* glsl */ `
precision highp float;
precision highp sampler2D;

uniform sampler2D uVelocity;

varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;

void main() {
  float L = texture2D(uVelocity, vL).y;
  float R = texture2D(uVelocity, vR).y;
  float T = texture2D(uVelocity, vT).x;
  float B = texture2D(uVelocity, vB).x;
  gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}
`;

/** Vorticity confinement: puts back the small eddies the solver smears out. */
const VORTICITY_FRAGMENT = /* glsl */ `
precision highp float;
precision highp sampler2D;

uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float uCurlStrength;
uniform float uDt;

varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;

void main() {
  float L = texture2D(uCurl, vL).x;
  float R = texture2D(uCurl, vR).x;
  float T = texture2D(uCurl, vT).x;
  float B = texture2D(uCurl, vB).x;
  float C = texture2D(uCurl, vUv).x;

  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= uCurlStrength * C;
  force.y *= -1.0;

  vec2 velocity = texture2D(uVelocity, vUv).xy;
  velocity += force * uDt;
  velocity = clamp(velocity, -1000.0, 1000.0);

  gl_FragColor = vec4(velocity, 0.0, 1.0);
}
`;

const PRESSURE_FRAGMENT = /* glsl */ `
precision highp float;
precision highp sampler2D;

uniform sampler2D uPressure;
uniform sampler2D uDivergence;

varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;

void main() {
  float L = texture2D(uPressure, vL).x;
  float R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x;
  float B = texture2D(uPressure, vB).x;
  float divergence = texture2D(uDivergence, vUv).x;
  gl_FragColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);
}
`;

const GRADIENT_FRAGMENT = /* glsl */ `
precision highp float;
precision highp sampler2D;

uniform sampler2D uPressure;
uniform sampler2D uVelocity;

varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;

void main() {
  float L = texture2D(uPressure, vL).x;
  float R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x;
  float B = texture2D(uPressure, vB).x;
  vec2 velocity = texture2D(uVelocity, vUv).xy;
  velocity -= vec2(R - L, T - B);
  gl_FragColor = vec4(velocity, 0.0, 1.0);
}
`;

const CLEAR_FRAGMENT = /* glsl */ `
precision highp float;
precision highp sampler2D;

uniform sampler2D uTexture;
uniform float uValue;

varying vec2 vUv;

void main() {
  gl_FragColor = uValue * texture2D(uTexture, vUv);
}
`;

const SPLAT_FRAGMENT = /* glsl */ `
precision highp float;
precision highp sampler2D;

uniform sampler2D uTarget;
uniform float uAspect;
uniform vec3 uColor;
uniform vec2 uPoint;
uniform float uRadius;

varying vec2 vUv;

void main() {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  vec3 splat = exp(-dot(p, p) / max(uRadius, 0.00001)) * uColor;
  vec3 base = texture2D(uTarget, vUv).xyz;
  gl_FragColor = vec4(base + splat, 1.0);
}
`;

const DISPLAY_FRAGMENT = /* glsl */ `
precision highp float;
precision highp sampler2D;

uniform sampler2D uTexture;
uniform float uOpacity;

varying vec2 vUv;

void main() {
  vec3 color = texture2D(uTexture, vUv).rgb;
  float alpha = clamp(max(color.r, max(color.g, color.b)), 0.0, 1.0) * uOpacity;
  // Premultiplied, to match the renderer's default blending.
  gl_FragColor = vec4(color * uOpacity, alpha);
}
`;

/**
 * A real incompressible-fluid solver running on the GPU: the pointer injects
 * velocity and dye, a Jacobi pressure solve keeps the flow divergence-free,
 * and vorticity confinement puts the eddies back.
 *
 * The most expensive background in the set. Drop `simResolution` before
 * `maxDpr` if you need to claw back frames — the simulation cost is
 * independent of the canvas size.
 *
 * ```html
 * <ngb-liquid-ether class="absolute inset-0 -z-10"
 *   [colors]="['#5227ff','#ff9ffd','#b19eef']" autoDemo />
 * ```
 */
@Component({
  selector: 'ngb-liquid-ether',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbLiquidEther extends NgbBackgroundBase {
  /** Palette the injected dye cycles through. */
  readonly colors = input<readonly string[]>(['#5227ff', '#ff9ffd', '#b19eef']);
  /** Grid size of the velocity/pressure simulation. Powers of two work best. */
  readonly simResolution = input(128, { transform: numberAttribute });
  /** Grid size of the dye. Raise for crisper filaments. */
  readonly dyeResolution = input(512, { transform: numberAttribute });
  /** How hard the pointer pushes the fluid. */
  readonly force = input(1, { transform: numberAttribute });
  /** Radius of the injected blob, in element widths. */
  readonly cursorSize = input(0.2, { transform: numberAttribute });
  /** Jacobi iterations per frame. Below ~12 the fluid stops looking solid. */
  readonly pressureIterations = input(20, { transform: numberAttribute });
  /** Swirl strength. */
  readonly curl = input(24, { transform: numberAttribute });
  /** How fast the dye fades, per second. */
  readonly dyeDecay = input(0.9, { transform: numberAttribute });
  /** How fast the motion dies down, per second. */
  readonly velocityDecay = input(0.25, { transform: numberAttribute });
  /** Layer opacity. */
  readonly opacity = input(1, { transform: numberAttribute });
  /** Keep the fluid moving on its own when the pointer is idle. */
  readonly autoDemo = input(true, { transform: booleanAttribute });
  /** Seconds of pointer inactivity before the auto motion takes over. */
  readonly autoDelay = input(2, { transform: numberAttribute });

  private renderer!: WebGLRenderer;
  private scene!: Scene;
  private camera!: OrthographicCamera;
  private quad!: Mesh;

  private velocity!: DoubleTarget;
  private dye!: DoubleTarget;
  private pressure!: DoubleTarget;
  private divergence!: WebGLRenderTarget;
  private curlTarget!: WebGLRenderTarget;

  private materials!: {
    advection: ShaderMaterial;
    divergence: ShaderMaterial;
    curl: ShaderMaterial;
    vorticity: ShaderMaterial;
    pressure: ShaderMaterial;
    gradient: ShaderMaterial;
    clear: ShaderMaterial;
    splat: ShaderMaterial;
    display: ShaderMaterial;
  };

  private simSize = new Vector2(128, 128);
  private dyeSize = new Vector2(512, 512);
  private aspect = 1;

  private palette: Rgb[] = [[0.32, 0.15, 1]];
  private paletteIndex = 0;

  /** Splats queued this frame, in normalised coordinates. */
  private readonly queued: { x: number; y: number; dx: number; dy: number }[] = [];
  /** Starts in the past so the auto motion does not wait out `autoDelay`. */
  private lastPointerTime = Number.NEGATIVE_INFINITY;
  private autoPhase = Math.random() * 100;
  private autoX = 0.5;
  private autoY = 0.5;

  protected override trackPointer = true;

  constructor() {
    super();
    effect(() => {
      const colors = this.colors();
      this.palette = colors.length ? colors.map((c) => toRgb(c)) : [[0.32, 0.15, 1]];
    });
    effect(() => {
      // Resolution changes need the whole FBO chain rebuilt.
      this.simResolution();
      this.dyeResolution();
      if (this.renderer) this.buildTargets();
    });
  }

  protected setup(canvas: HTMLCanvasElement): void {
    this.renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    this.renderer.autoClear = false;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.viewWidth, this.viewHeight, false);

    this.scene = new Scene();
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new Mesh(new PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);

    this.materials = {
      advection: this.createMaterial(ADVECTION_FRAGMENT, {
        uVelocity: { value: null },
        uSource: { value: null },
        uSourceTexelSize: { value: new Vector2() },
        uDt: { value: 1 / 60 },
        uDissipation: { value: 0 },
      }),
      divergence: this.createMaterial(DIVERGENCE_FRAGMENT, { uVelocity: { value: null } }),
      curl: this.createMaterial(CURL_FRAGMENT, { uVelocity: { value: null } }),
      vorticity: this.createMaterial(VORTICITY_FRAGMENT, {
        uVelocity: { value: null },
        uCurl: { value: null },
        uCurlStrength: { value: 24 },
        uDt: { value: 1 / 60 },
      }),
      pressure: this.createMaterial(PRESSURE_FRAGMENT, {
        uPressure: { value: null },
        uDivergence: { value: null },
      }),
      gradient: this.createMaterial(GRADIENT_FRAGMENT, {
        uPressure: { value: null },
        uVelocity: { value: null },
      }),
      clear: this.createMaterial(CLEAR_FRAGMENT, {
        uTexture: { value: null },
        uValue: { value: 0.8 },
      }),
      splat: this.createMaterial(SPLAT_FRAGMENT, {
        uTarget: { value: null },
        uAspect: { value: 1 },
        uColor: { value: [0, 0, 0] },
        uPoint: { value: new Vector2(0.5, 0.5) },
        uRadius: { value: 0.01 },
      }),
      display: this.createMaterial(DISPLAY_FRAGMENT, {
        uTexture: { value: null },
        uOpacity: { value: 1 },
      }),
    };
    this.materials.display.transparent = true;

    this.buildTargets();
    this.seed();
    this.hostRef.nativeElement.addEventListener('pointerdown', this.handlePointerDown);
  }

  /** Prime the dye so the very first frame already has something in it. */
  private seed(): void {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      this.queued.push({
        x: 0.5 + Math.cos(angle) * 0.22,
        y: 0.5 + Math.sin(angle) * 0.22,
        dx: Math.cos(angle) * 0.05,
        dy: Math.sin(angle) * 0.05,
      });
    }
  }

  protected teardown(): void {
    this.hostRef.nativeElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.disposeTargets();
    if (this.materials) {
      for (const material of Object.values(this.materials)) material.dispose();
    }
    this.quad?.geometry.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer = undefined!;
  }

  protected onResize(width: number, height: number, dpr: number): void {
    if (!this.renderer) return;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.aspect = width / Math.max(height, 1);
    this.buildTargets();
  }

  protected frame(time: number, delta: number): void {
    if (!this.renderer || !this.velocity) return;

    // Fixed step: a variable dt makes the Jacobi solve wobble.
    const dt = Math.min(Math.max(delta, 1 / 240), 1 / 30);

    this.collectInput(time, delta);
    this.applySplats();
    this.step(dt);
    this.present();
  }

  // --- Simulation --------------------------------------------------------

  private step(dt: number): void {
    const m = this.materials;

    m.curl.uniforms['uVelocity'].value = this.velocity.read.texture;
    this.blit(this.curlTarget, m.curl);

    m.vorticity.uniforms['uVelocity'].value = this.velocity.read.texture;
    m.vorticity.uniforms['uCurl'].value = this.curlTarget.texture;
    m.vorticity.uniforms['uCurlStrength'].value = this.curl();
    m.vorticity.uniforms['uDt'].value = dt;
    this.blit(this.velocity.write, m.vorticity);
    this.swap(this.velocity);

    m.divergence.uniforms['uVelocity'].value = this.velocity.read.texture;
    this.blit(this.divergence, m.divergence);

    // Decay the previous pressure field instead of clearing it: the solve
    // converges much faster from a warm start.
    m.clear.uniforms['uTexture'].value = this.pressure.read.texture;
    m.clear.uniforms['uValue'].value = 0.8;
    this.blit(this.pressure.write, m.clear);
    this.swap(this.pressure);

    m.pressure.uniforms['uDivergence'].value = this.divergence.texture;
    const iterations = Math.max(1, Math.round(this.pressureIterations()));
    for (let i = 0; i < iterations; i++) {
      m.pressure.uniforms['uPressure'].value = this.pressure.read.texture;
      this.blit(this.pressure.write, m.pressure);
      this.swap(this.pressure);
    }

    m.gradient.uniforms['uPressure'].value = this.pressure.read.texture;
    m.gradient.uniforms['uVelocity'].value = this.velocity.read.texture;
    this.blit(this.velocity.write, m.gradient);
    this.swap(this.velocity);

    const simTexel = new Vector2(1 / this.simSize.x, 1 / this.simSize.y);

    m.advection.uniforms['uVelocity'].value = this.velocity.read.texture;
    m.advection.uniforms['uSource'].value = this.velocity.read.texture;
    m.advection.uniforms['uSourceTexelSize'].value = simTexel;
    m.advection.uniforms['uDt'].value = dt;
    m.advection.uniforms['uDissipation'].value = this.velocityDecay();
    this.blit(this.velocity.write, m.advection);
    this.swap(this.velocity);

    m.advection.uniforms['uVelocity'].value = this.velocity.read.texture;
    m.advection.uniforms['uSource'].value = this.dye.read.texture;
    m.advection.uniforms['uDissipation'].value = this.dyeDecay();
    this.blit(this.dye.write, m.advection);
    this.swap(this.dye);
  }

  private present(): void {
    this.materials.display.uniforms['uTexture'].value = this.dye.read.texture;
    this.materials.display.uniforms['uOpacity'].value = this.opacity();
    this.renderer.setRenderTarget(null);
    this.renderer.clear();
    this.quad.material = this.materials.display;
    this.renderer.render(this.scene, this.camera);
  }

  // --- Input -------------------------------------------------------------

  private collectInput(time: number, delta: number): void {
    if (this.pointer.inside && (this.pointer.dx !== 0 || this.pointer.dy !== 0)) {
      this.lastPointerTime = time;
      this.queued.push({
        x: this.pointer.nx,
        y: 1 - this.pointer.ny,
        dx: this.pointer.dx / Math.max(this.viewWidth, 1),
        dy: -this.pointer.dy / Math.max(this.viewHeight, 1),
      });
      return;
    }

    if (!this.autoDemo()) return;
    if (time - this.lastPointerTime < this.autoDelay()) return;

    // A slow Lissajous walk keeps the fluid alive without any input.
    this.autoPhase += delta;
    const nx = 0.5 + Math.sin(this.autoPhase * 0.45) * 0.32 + Math.sin(this.autoPhase * 0.17) * 0.1;
    const ny = 0.5 + Math.cos(this.autoPhase * 0.37) * 0.28 + Math.cos(this.autoPhase * 0.23) * 0.1;
    this.queued.push({ x: nx, y: ny, dx: (nx - this.autoX) * 0.9, dy: (ny - this.autoY) * 0.9 });
    this.autoX = nx;
    this.autoY = ny;
  }

  private applySplats(): void {
    if (!this.queued.length) return;

    const m = this.materials;
    const force = this.force() * 900;
    const radius = Math.max(this.cursorSize() * 0.01, 0.00001);

    for (const splat of this.queued) {
      m.splat.uniforms['uAspect'].value = this.aspect;
      m.splat.uniforms['uPoint'].value.set(splat.x, splat.y);
      m.splat.uniforms['uRadius'].value = radius;

      m.splat.uniforms['uTarget'].value = this.velocity.read.texture;
      m.splat.uniforms['uColor'].value = [splat.dx * force, splat.dy * force, 0];
      this.blit(this.velocity.write, m.splat);
      this.swap(this.velocity);

      const color = this.palette[this.paletteIndex % this.palette.length];
      this.paletteIndex++;
      m.splat.uniforms['uTarget'].value = this.dye.read.texture;
      m.splat.uniforms['uColor'].value = [color[0] * 0.35, color[1] * 0.35, color[2] * 0.35];
      this.blit(this.dye.write, m.splat);
      this.swap(this.dye);
    }

    this.queued.length = 0;
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    // A click is a burst in a random direction, so tapping does something.
    const angle = Math.random() * Math.PI * 2;
    this.queued.push({
      x: (event.clientX - rect.left) / rect.width,
      y: 1 - (event.clientY - rect.top) / rect.height,
      dx: Math.cos(angle) * 0.04,
      dy: Math.sin(angle) * 0.04,
    });
  };

  // --- Plumbing ----------------------------------------------------------

  private createMaterial(fragmentShader: string, uniforms: Record<string, { value: unknown }>) {
    return new ShaderMaterial({
      vertexShader: BASE_VERTEX,
      fragmentShader,
      uniforms: { uTexelSize: { value: new Vector2() }, ...uniforms },
      depthTest: false,
      depthWrite: false,
    });
  }

  private blit(target: WebGLRenderTarget | null, material: ShaderMaterial): void {
    const width = target ? target.width : this.viewWidth;
    const height = target ? target.height : this.viewHeight;
    material.uniforms['uTexelSize'].value.set(1 / width, 1 / height);
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
  }

  private swap(target: DoubleTarget): void {
    const temp = target.read;
    target.read = target.write;
    target.write = temp;
  }

  private buildTargets(): void {
    this.disposeTargets();

    this.aspect = this.viewWidth / Math.max(this.viewHeight, 1);

    const sim = Math.max(32, Math.round(this.simResolution()));
    const dye = Math.max(64, Math.round(this.dyeResolution()));

    this.simSize = this.fitToAspect(sim);
    this.dyeSize = this.fitToAspect(dye);

    this.velocity = this.createDouble(this.simSize);
    this.pressure = this.createDouble(this.simSize);
    this.dye = this.createDouble(this.dyeSize);
    this.divergence = this.createTarget(this.simSize);
    this.curlTarget = this.createTarget(this.simSize);
  }

  /** Keep the grid roughly square-celled by stretching along the long axis. */
  private fitToAspect(base: number): Vector2 {
    return this.aspect >= 1
      ? new Vector2(Math.round(base * this.aspect), base)
      : new Vector2(base, Math.round(base / Math.max(this.aspect, 0.0001)));
  }

  private createTarget(size: Vector2): WebGLRenderTarget {
    return new WebGLRenderTarget(size.x, size.y, {
      type: HalfFloatType,
      format: RGBAFormat,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      wrapS: ClampToEdgeWrapping,
      wrapT: ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
    });
  }

  private createDouble(size: Vector2): DoubleTarget {
    return { read: this.createTarget(size), write: this.createTarget(size) };
  }

  private disposeTargets(): void {
    for (const pair of [this.velocity, this.pressure, this.dye]) {
      pair?.read.dispose();
      pair?.write.dispose();
    }
    this.divergence?.dispose();
    this.curlTarget?.dispose();
    this.velocity = undefined!;
    this.pressure = undefined!;
    this.dye = undefined!;
    this.divergence = undefined!;
    this.curlTarget = undefined!;
  }
}
