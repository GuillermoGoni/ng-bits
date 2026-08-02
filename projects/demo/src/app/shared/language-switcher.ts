import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLanguages } from '@ng-icons/lucide';

import { DemoLocaleService } from '../i18n/demo-locale.service';

@Component({
  selector: 'app-language-switcher',
  imports: [NgIcon, TranslatePipe],
  providers: [provideIcons({ lucideLanguages })],
  template: `
    <div class="language-switcher" role="group" [attr.aria-label]="'nav.language' | translate">
      <span class="language-switcher-icon" aria-hidden="true">
        <ng-icon name="lucideLanguages" size="15" />
      </span>
      @for (language of locale.languages; track language.code) {
        <button
          type="button"
          [attr.aria-pressed]="locale.language() === language.code"
          [attr.aria-label]="language.code === 'en' ? 'English' : 'Español'"
          (click)="locale.setLanguage(language.code)"
        >
          {{ language.label }}
        </button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageSwitcher {
  protected readonly locale = inject(DemoLocaleService);
}
