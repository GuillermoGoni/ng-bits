import { afterNextRender, ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { DemoLocaleService } from './i18n/demo-locale.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly locale = inject(DemoLocaleService);

  constructor() {
    afterNextRender(() => this.locale.restoreSavedLanguage());
  }
}
