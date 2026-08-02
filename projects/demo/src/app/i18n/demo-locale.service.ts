import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { DemoLanguage } from './translations';

const STORAGE_KEY = 'ng-bits-demo-language';

@Injectable({ providedIn: 'root' })
export class DemoLocaleService {
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  readonly language = signal<DemoLanguage>('en');
  readonly languages: readonly { code: DemoLanguage; label: string }[] = [
    { code: 'en', label: 'EN' },
    { code: 'es', label: 'ES' },
  ];

  constructor() {
    effect(() => {
      this.document.documentElement.lang = this.language();
    });
  }

  setLanguage(language: DemoLanguage): void {
    if (language === this.language()) return;

    this.language.set(language);
    this.translate.use(language).subscribe({
      error: () => this.language.set('en'),
    });

    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem(STORAGE_KEY, language);
      } catch {
        // Storage can be unavailable in privacy modes; translation still works.
      }
    }
  }

  /** Run after hydration so SSR always begins with the same language as the client. */
  restoreSavedLanguage(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'es') this.setLanguage(saved);
    } catch {
      // A missing storage implementation is not an application error.
    }
  }
}
