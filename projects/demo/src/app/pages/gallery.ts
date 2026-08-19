import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowDown, lucideArrowUpRight, lucidePackage } from '@ng-icons/lucide';
import { NgbAurora } from 'ng-bits';

import { BACKGROUNDS, BackgroundEntry } from '../registry';
import { CopyButton } from '../shared/copy-button';
import { LanguageSwitcher } from '../shared/language-switcher';
import { InViewDirective } from '../in-view.directive';

interface Tile {
  entry: BackgroundEntry;
  inputs: Record<string, unknown>;
}

const githubMark =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.084 1.84 1.237 1.84 1.237 1.07 1.835 2.809 1.305 3.495.998.108-.776.418-1.305.762-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23a11.5 11.5 0 0 1 3-.405c1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>';

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
  providers: [provideIcons({ githubMark, lucideArrowDown, lucideArrowUpRight, lucidePackage })],
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
