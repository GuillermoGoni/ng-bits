import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowDown, lucideArrowUpRight } from '@ng-icons/lucide';
import { NgbAurora } from 'ng-bits';

import { BACKGROUNDS, BackgroundEntry } from '../registry';
import { CopyButton } from '../shared/copy-button';
import { LanguageSwitcher } from '../shared/language-switcher';
import { InViewDirective } from '../in-view.directive';

interface Tile {
  entry: BackgroundEntry;
  inputs: Record<string, unknown>;
}

@Component({
  selector: 'app-gallery',
  imports: [
    CopyButton,
    LanguageSwitcher,
    NgComponentOutlet,
    NgIcon,
    NgbAurora,
    InViewDirective,
    RouterLink,
    TranslatePipe,
  ],
  providers: [provideIcons({ lucideArrowDown, lucideArrowUpRight })],
  templateUrl: './gallery.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Gallery {
  protected readonly tiles: readonly Tile[] = BACKGROUNDS.map((entry) => ({
    entry,
    inputs: { ...entry.defaults, maxDpr: 1, ...entry.tile },
  }));

  protected taglineKey(entry: BackgroundEntry): string {
    return `backgrounds.${entry.slug}.tagline`;
  }
}
