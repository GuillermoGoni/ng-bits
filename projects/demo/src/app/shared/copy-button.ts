import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  booleanAttribute,
  inject,
  input,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCopy } from '@ng-icons/lucide';

type CopyState = 'idle' | 'copied' | 'error';

@Component({
  selector: 'app-copy-button',
  imports: [NgIcon, TranslatePipe],
  providers: [provideIcons({ lucideCheck, lucideCopy })],
  template: `
    <button
      type="button"
      class="copy-button"
      [class.copy-button-compact]="compact()"
      [class.copy-button-success]="state() === 'copied'"
      [attr.aria-label]="(state() === 'idle' ? label() : statusKey()) | translate"
      (click)="copy()"
    >
      <span class="relative grid size-4 place-items-center" aria-hidden="true">
        <ng-icon
          name="lucideCopy"
          size="16"
          class="absolute transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
          [class.scale-[0.25]]="state() === 'copied'"
          [class.opacity-0]="state() === 'copied'"
          [class.blur-[4px]]="state() === 'copied'"
        />
        <ng-icon
          name="lucideCheck"
          size="16"
          class="absolute transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
          [class.scale-[0.25]]="state() !== 'copied'"
          [class.opacity-0]="state() !== 'copied'"
          [class.blur-[4px]]="state() !== 'copied'"
        />
      </span>
      @if (!compact()) {
        <span>{{ (state() === 'idle' ? label() : statusKey()) | translate }}</span>
      }
    </button>
    <span class="sr-only" aria-live="polite">{{ statusKey() | translate }}</span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CopyButton {
  readonly value = input.required<string>();
  readonly label = input('common.copy');
  readonly compact = input(false, { transform: booleanAttribute });

  protected readonly state = signal<CopyState>('idle');

  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private resetTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.resetTimer));
  }

  protected statusKey(): string {
    switch (this.state()) {
      case 'copied':
        return 'common.copied';
      case 'error':
        return 'common.copyFailed';
      default:
        return this.label();
    }
  }

  protected async copy(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(this.value());
      } else if (!this.copyWithSelection()) {
        throw new Error('Clipboard API unavailable');
      }
      this.setState('copied');
    } catch {
      this.setState('error');
    }
  }

  private copyWithSelection(): boolean {
    const textarea = document.createElement('textarea');
    textarea.value = this.value();
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  }

  private setState(state: CopyState): void {
    clearTimeout(this.resetTimer);
    this.state.set(state);
    this.resetTimer = setTimeout(() => this.state.set('idle'), 1800);
  }
}
