import { bootstrapApplication } from '@angular/platform-browser';

import { App } from './app/app';
import { hydratedAppConfig } from './app/app.config.hydrated';

bootstrapApplication(App, hydratedAppConfig).catch((err) => console.error(err));
