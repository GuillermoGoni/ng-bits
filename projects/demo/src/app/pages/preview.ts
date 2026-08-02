import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

import { BACKGROUNDS, Control, findBackground } from '../registry';

@Component({
  selector: 'app-preview',
  imports: [NgComponentOutlet, RouterLink],
  templateUrl: './preview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Preview {
  /** Bound from the route via `withComponentInputBinding()`. */
  readonly slug = input('');

  protected readonly all = BACKGROUNDS;
  protected readonly entry = computed(() => findBackground(this.slug()));
  protected readonly panelOpen = signal(true);

  /** Edits are tagged with their slug, so navigating resets the panel for free. */
  private readonly edits = signal<{ slug: string; values: Record<string, unknown> } | null>(null);

  /** Cached by the computed, so the outlet sees a stable object reference. */
  protected readonly values = computed<Record<string, unknown>>(() => {
    const entry = this.entry();
    if (!entry) return {};
    const edits = this.edits();
    return edits && edits.slug === entry.slug ? edits.values : { ...entry.defaults };
  });

  protected numberValue(key: string): number {
    return Number(this.values()[key] ?? 0);
  }

  protected stringValue(key: string): string {
    return String(this.values()[key] ?? '');
  }

  protected boolValue(key: string): boolean {
    return Boolean(this.values()[key]);
  }

  protected colorsValue(key: string): string[] {
    const value = this.values()[key];
    return Array.isArray(value) ? (value as string[]) : [];
  }

  /** Pad short arrays so a control always shows every slot it declares. */
  protected colorSlots(control: Control & { kind: 'colors' }): number[] {
    const length = Math.max(this.colorsValue(control.key).length, control.count);
    return Array.from({ length }, (_, index) => index);
  }

  protected set(key: string, value: unknown): void {
    const entry = this.entry();
    if (!entry) return;
    this.edits.set({ slug: entry.slug, values: { ...this.values(), [key]: value } });
  }

  protected setNumber(key: string, event: Event): void {
    this.set(key, Number((event.target as HTMLInputElement).value));
  }

  protected setString(key: string, event: Event): void {
    this.set(key, (event.target as HTMLInputElement | HTMLSelectElement).value);
  }

  protected setBool(key: string, event: Event): void {
    this.set(key, (event.target as HTMLInputElement).checked);
  }

  protected setColorAt(key: string, index: number, event: Event): void {
    const next = [...this.colorsValue(key)];
    next[index] = (event.target as HTMLInputElement).value;
    this.set(key, next);
  }

  protected reset(): void {
    this.edits.set(null);
  }

  protected readonly snippet = computed(() => {
    const entry = this.entry();
    if (!entry) return '';

    const attributes = Object.entries(this.values())
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => {
        if (typeof value === 'string') return `  ${key}="${value}"`;
        if (Array.isArray(value)) return `  [${key}]="[${value.map((v) => `'${v}'`).join(', ')}]"`;
        return `  [${key}]="${value}"`;
      });

    return [`<ngb-${entry.slug}`, `  class="absolute inset-0 -z-10"`, ...attributes, `/>`].join('\n');
  });

  protected copySnippet(): void {
    void navigator.clipboard?.writeText(this.snippet());
  }
}
