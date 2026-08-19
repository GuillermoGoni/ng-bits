import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { DEMO_TRANSLATIONS } from './i18n/translations';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
    provideAppInitializer(() => {
      const translate = inject(TranslateService);
      translate.setTranslation('en', DEMO_TRANSLATIONS.en);
      translate.setTranslation('es', DEMO_TRANSLATIONS.es);
      return translate.use('en');
    }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
  ],
};
