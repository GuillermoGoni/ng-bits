import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgbAurora } from 'ng-bits';

import { BACKGROUNDS, BackgroundEntry } from '../registry';
import { InViewDirective } from '../in-view.directive';

interface Tile {
  entry: BackgroundEntry;
  /** Precomputed so the outlet is not handed a fresh object every check. */
  inputs: Record<string, unknown>;
}

@Component({
  selector: 'app-gallery',
  imports: [NgComponentOutlet, RouterLink, InViewDirective, NgbAurora],
  templateUrl: './gallery.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Gallery {
  /** Tiles render cheaper than the full-page preview. */
  protected readonly tiles: readonly Tile[] = BACKGROUNDS.map((entry) => ({
    entry,
    inputs: { ...entry.defaults, maxDpr: 1, ...entry.tile },
  }));
}
