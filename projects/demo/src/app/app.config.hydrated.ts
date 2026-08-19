import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';

import { appConfig } from './app.config';

const hydrationConfig: ApplicationConfig = {
  providers: [provideClientHydration()],
};

export const hydratedAppConfig = mergeApplicationConfig(appConfig, hydrationConfig);
