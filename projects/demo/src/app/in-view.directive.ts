import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';

/**
 * Exposes whether the host is near the viewport, so the gallery can create and
 * destroy live backgrounds instead of holding a WebGL context per tile —
 * browsers cap those at around sixteen.
 *
 * ```html
 * <div appInView #tile="inView">
 *   @if (tile.visible()) { ... }
 * </div>
 * ```
 */
@Directive({
  selector: '[appInView]',
  exportAs: 'inView',
})
export class InViewDirective {
  /** Extra margin around the viewport, in CSS pixels. */
  readonly inViewMargin = input(0, { transform: numberAttribute });

  readonly visible = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') {
        this.visible.set(true);
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => this.visible.set(entries.some((entry) => entry.isIntersecting)),
        { rootMargin: `${this.inViewMargin()}px` },
      );
      observer.observe(this.host.nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
