import { isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  Directive,
  ElementRef,
  NgZone,
  PLATFORM_ID,
  afterNextRender,
  booleanAttribute,
  effect,
  inject,
  input,
  numberAttribute,
} from '@angular/core';

/**
 * Host + canvas styling shared by every background. Backgrounds fill their
 * parent, so the consumer positions them (usually `absolute inset-0 -z-10`).
 */
export const NGB_BACKGROUND_STYLES = `
:host {
  display: block;
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
canvas {
  display: block;
  width: 100%;
  height: 100%;
}
`;

/** Pointer state, refreshed once per frame when a background opts in. */
export interface NgbPointer {
  /** Position in CSS pixels, relative to the host element. */
  x: number;
  y: number;
  /** Position normalised to 0..1, `ny` measured from the top. */
  nx: number;
  ny: number;
  /** `nx`/`ny` run through an exponential smoother. */
  sx: number;
  sy: number;
  /** Movement since the previous frame, in CSS pixels. */
  dx: number;
  dy: number;
  /** Whether the pointer is currently over the host element. */
  inside: boolean;
}

/**
 * Lifecycle plumbing for canvas-driven backgrounds: creates the canvas, keeps
 * it sized to the host, drives a rAF loop outside the Angular zone, pauses
 * when off-screen or when the user prefers reduced motion, and recovers from
 * WebGL context loss.
 *
 * Subclasses implement {@link setup}, {@link onResize}, {@link frame} and
 * {@link teardown}; none of them ever run on the server.
 */
@Directive()
export abstract class NgbBackgroundBase {
  protected readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Freeze the animation without tearing down the GPU resources. */
  readonly paused = input(false, { transform: booleanAttribute });
  /** Upper bound for `devicePixelRatio`. Lower it to trade sharpness for framerate. */
  readonly maxDpr = input(2, { transform: numberAttribute });
  /** Stop rendering while the host element is outside the viewport. */
  readonly pauseWhenHidden = input(true, { transform: booleanAttribute });
  /** `respect` renders a single static frame when the OS asks for reduced motion. */
  readonly reducedMotion = input<'respect' | 'ignore'>('respect');

  protected canvas!: HTMLCanvasElement;
  /** Host size in CSS pixels. */
  protected viewWidth = 1;
  protected viewHeight = 1;
  /** Effective pixel ratio, already clamped by {@link maxDpr}. */
  protected pixelRatio = 1;
  protected readonly pointer: NgbPointer = {
    x: 0,
    y: 0,
    nx: 0.5,
    ny: 0.5,
    sx: 0.5,
    sy: 0.5,
    dx: 0,
    dy: 0,
    inside: false,
  };

  /** Set from a subclass field initialiser to receive pointer updates. */
  protected trackPointer = false;
  /** Per-frame lerp factor for `pointer.sx`/`pointer.sy`. */
  protected pointerSmoothing = 0.08;

  private rafId = 0;
  private running = false;
  private ready = false;
  private onScreen = true;
  private prefersReduced = false;
  private lastNow = 0;
  private elapsed = 0;
  private resizeObserver?: ResizeObserver;
  private intersectionObserver?: IntersectionObserver;
  private motionQuery?: MediaQueryList;

  constructor() {
    afterNextRender(() => this.bootstrap());

    effect(() => {
      // Track every input that can start or stop the loop.
      this.paused();
      this.pauseWhenHidden();
      this.reducedMotion();
      if (this.ready) this.syncLoop();
    });

    effect(() => {
      this.maxDpr();
      if (this.ready) this.measureAndResize();
    });

    this.destroyRef.onDestroy(() => this.dispose());
  }

  // --- Subclass contract -------------------------------------------------

  /** Create the renderer. Runs once, in the browser, after the host is laid out. */
  protected abstract setup(canvas: HTMLCanvasElement): void;

  /** Draw one frame. `time` is seconds since setup, excluding paused time. */
  protected abstract frame(time: number, delta: number): void;

  /** Host was resized. Sizes are CSS pixels; the backing store is already updated. */
  protected abstract onResize(width: number, height: number, dpr: number): void;

  /** Release GPU resources. */
  protected abstract teardown(): void;

  // --- Helpers for subclasses -------------------------------------------

  /** Seconds elapsed, excluding time spent paused. */
  protected get time(): number {
    return this.elapsed;
  }

  /** Force a redraw while paused — useful after an input change. */
  protected requestFrame(): void {
    if (!this.ready || this.running) return;
    this.frame(this.elapsed, 0);
  }

  // --- Lifecycle ---------------------------------------------------------

  private bootstrap(): void {
    if (!this.isBrowser) return;

    const host = this.hostRef.nativeElement;
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(this.canvas);

    this.canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);

    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.prefersReduced = this.motionQuery.matches;
    this.motionQuery.addEventListener('change', this.handleMotionChange);

    this.measure();

    this.ngZone.runOutsideAngular(() => this.setup(this.canvas));
    this.ready = true;
    this.applySize();

    this.resizeObserver = new ResizeObserver(() => this.measureAndResize());
    this.resizeObserver.observe(host);

    if (typeof IntersectionObserver !== 'undefined') {
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          this.onScreen = entries.some((entry) => entry.isIntersecting);
          this.syncLoop();
        },
        { rootMargin: '128px' },
      );
      this.intersectionObserver.observe(host);
    }

    if (this.trackPointer) {
      host.addEventListener('pointermove', this.handlePointerMove, { passive: true });
      host.addEventListener('pointerenter', this.handlePointerEnter, { passive: true });
      host.addEventListener('pointerleave', this.handlePointerLeave, { passive: true });
    }

    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    this.syncLoop();
    // Always paint once, so a paused or reduced-motion background is not blank.
    this.frame(0, 0);
  }

  private dispose(): void {
    this.stopLoop();
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.motionQuery?.removeEventListener('change', this.handleMotionChange);

    if (this.isBrowser) {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      const host = this.hostRef.nativeElement;
      host.removeEventListener('pointermove', this.handlePointerMove);
      host.removeEventListener('pointerenter', this.handlePointerEnter);
      host.removeEventListener('pointerleave', this.handlePointerLeave);
    }

    if (!this.ready) return;
    this.ready = false;
    this.canvas?.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas?.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.teardown();
    this.canvas?.remove();
  }

  // --- Sizing ------------------------------------------------------------

  private measure(): boolean {
    const host = this.hostRef.nativeElement;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, this.maxDpr()));
    const changed = width !== this.viewWidth || height !== this.viewHeight || dpr !== this.pixelRatio;
    this.viewWidth = width;
    this.viewHeight = height;
    this.pixelRatio = dpr;
    return changed;
  }

  private applySize(): void {
    this.canvas.width = Math.round(this.viewWidth * this.pixelRatio);
    this.canvas.height = Math.round(this.viewHeight * this.pixelRatio);
    this.onResize(this.viewWidth, this.viewHeight, this.pixelRatio);
  }

  private measureAndResize(): void {
    if (!this.ready) return;
    if (!this.measure()) return;
    this.applySize();
    if (!this.running) this.frame(this.elapsed, 0);
  }

  // --- Loop --------------------------------------------------------------

  private get shouldRun(): boolean {
    if (!this.ready) return false;
    if (this.paused()) return false;
    if (this.pauseWhenHidden() && !this.onScreen) return false;
    if (this.isBrowser && document.hidden) return false;
    if (this.reducedMotion() === 'respect' && this.prefersReduced) return false;
    return true;
  }

  private syncLoop(): void {
    if (this.shouldRun) this.startLoop();
    else this.stopLoop();
  }

  private startLoop(): void {
    if (this.running) return;
    this.running = true;
    this.lastNow = 0;
    this.ngZone.runOutsideAngular(() => {
      this.rafId = requestAnimationFrame(this.tick);
    });
  }

  private stopLoop(): void {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);

    // Clamp so a backgrounded tab does not resume with a huge time step.
    const delta = this.lastNow ? Math.min((now - this.lastNow) / 1000, 1 / 20) : 0;
    this.lastNow = now;
    this.elapsed += delta;

    if (this.trackPointer) {
      const k = 1 - Math.pow(1 - this.pointerSmoothing, delta * 60 || 1);
      this.pointer.sx += (this.pointer.nx - this.pointer.sx) * k;
      this.pointer.sy += (this.pointer.ny - this.pointer.sy) * k;
    }

    this.frame(this.elapsed, delta);
    this.pointer.dx = 0;
    this.pointer.dy = 0;
  };

  // --- Events ------------------------------------------------------------

  private readonly handleMotionChange = (event: MediaQueryListEvent): void => {
    this.prefersReduced = event.matches;
    this.syncLoop();
  };

  private readonly handleVisibilityChange = (): void => this.syncLoop();

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const rect = this.hostRef.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this.pointer.dx = x - this.pointer.x;
    this.pointer.dy = y - this.pointer.y;
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.nx = rect.width ? x / rect.width : 0.5;
    this.pointer.ny = rect.height ? y / rect.height : 0.5;
    this.pointer.inside = true;
  };

  private readonly handlePointerEnter = (): void => {
    this.pointer.inside = true;
  };

  private readonly handlePointerLeave = (): void => {
    this.pointer.inside = false;
    this.pointer.dx = 0;
    this.pointer.dy = 0;
  };

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.stopLoop();
  };

  private readonly handleContextRestored = (): void => {
    if (!this.ready) return;
    this.teardown();
    this.ngZone.runOutsideAngular(() => this.setup(this.canvas));
    this.applySize();
    this.syncLoop();
  };
}
