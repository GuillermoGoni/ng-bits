import { Directive, effect } from '@angular/core';
import { Mesh, Program, Renderer, Triangle } from 'ogl';

import { NgbBackgroundBase } from './background-base';
import { NGB_FULLSCREEN_VERTEX } from './shader-chunks';

/** OGL accepts any of these as a uniform payload. */
export type NgbUniform = { value: unknown };
export type NgbUniforms = Record<string, NgbUniform>;

/** Renderer knobs a background can override before the context is created. */
export interface NgbRendererOptions {
  alpha?: boolean;
  antialias?: boolean;
  premultipliedAlpha?: boolean;
  depth?: boolean;
  powerPreference?: 'default' | 'high-performance' | 'low-power';
}

/**
 * Base for the full-screen shader backgrounds: one triangle, one program,
 * `uTime`/`uResolution` maintained for you. Subclasses supply the fragment
 * shader and their own uniforms, then push input changes in {@link update}.
 */
@Directive()
export abstract class NgbOglBackgroundBase extends NgbBackgroundBase {
  protected renderer!: Renderer;
  protected program!: Program;
  protected mesh!: Mesh;
  protected uniforms!: NgbUniforms;

  /** Fragment shader source. Must declare `varying vec2 vUv;`. */
  protected abstract readonly fragment: string;

  /** Override to swap in a custom vertex stage. */
  protected readonly vertex: string = NGB_FULLSCREEN_VERTEX;

  /** Uniforms owned by the subclass, merged with `uTime`/`uResolution`. */
  protected abstract buildUniforms(): NgbUniforms;

  /**
   * Push input signals into uniforms. Runs inside an effect, so read every
   * input you care about here and write with {@link setUniform}; it is also
   * called once right after the program is created.
   */
  protected syncUniforms(): void {}

  /** Called every frame before drawing, for values that change continuously. */
  protected update(_time: number, _delta: number): void {}

  constructor() {
    super();
    effect(() => {
      this.syncUniforms();
      this.requestFrame();
    });
  }

  /** Write a uniform if the program already exists; a no-op before setup. */
  protected setUniform(name: string, value: unknown): void {
    const uniform = this.uniforms?.[name];
    if (uniform) uniform.value = value;
  }

  protected rendererOptions(): NgbRendererOptions {
    return { alpha: true, antialias: false, premultipliedAlpha: true, depth: false };
  }

  protected override setup(canvas: HTMLCanvasElement): void {
    this.renderer = new Renderer({
      canvas,
      dpr: this.pixelRatio,
      width: this.viewWidth,
      height: this.viewHeight,
      ...this.rendererOptions(),
    });

    const gl = this.renderer.gl;
    gl.clearColor(0, 0, 0, 0);

    this.uniforms = {
      uTime: { value: 0 },
      uResolution: { value: [this.viewWidth * this.pixelRatio, this.viewHeight * this.pixelRatio] },
      uAspect: { value: this.viewWidth / Math.max(this.viewHeight, 1) },
      ...this.buildUniforms(),
    };

    this.program = new Program(gl, {
      vertex: this.vertex,
      fragment: this.fragment,
      uniforms: this.uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

    this.mesh = new Mesh(gl, { geometry: new Triangle(gl), program: this.program });
    this.syncUniforms();
  }

  protected override onResize(width: number, height: number, dpr: number): void {
    if (!this.renderer) return;
    this.renderer.dpr = dpr;
    this.renderer.setSize(width, height);
    // OGL writes inline px sizes; hand layout back to CSS so the canvas
    // tracks fluid containers without a one-frame lag.
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    (this.uniforms['uResolution'].value as number[])[0] = width * dpr;
    (this.uniforms['uResolution'].value as number[])[1] = height * dpr;
    this.uniforms['uAspect'].value = width / Math.max(height, 1);
  }

  protected override frame(time: number, delta: number): void {
    if (!this.renderer) return;
    this.uniforms['uTime'].value = time;
    this.update(time, delta);
    this.renderer.render({ scene: this.mesh });
  }

  protected override teardown(): void {
    const gl = this.renderer?.gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    this.renderer = undefined!;
    this.program = undefined!;
    this.mesh = undefined!;
  }
}
