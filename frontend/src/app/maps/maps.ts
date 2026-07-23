import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { MapSummary } from '../core/api.types';

@Component({
  selector: 'app-maps',
  imports: [RouterLink],
  templateUrl: './maps.html',
})
export class Maps implements OnInit {
  private readonly api = inject(ApiService);

  readonly maps = signal<readonly MapSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly failedMapIds = signal<ReadonlySet<string>>(new Set<string>());

  ngOnInit(): void {
    this.loadMaps();
  }

  loadMaps(): void {
    this.loading.set(true);
    this.error.set('');
    this.failedMapIds.set(new Set<string>());
    this.api.getMaps().subscribe({
      next: (response) => {
        this.maps.set(response.maps);
        this.loading.set(false);
      },
      error: () => {
        this.maps.set([]);
        this.loading.set(false);
        this.error.set('Could not load the maps. Please try again.');
      },
    });
  }

  onMapError(mapId: string): void {
    this.failedMapIds.update((failedIds) => new Set(failedIds).add(mapId));
  }

  onMapLoad(mapId: string, image: HTMLImageElement): void {
    if (image.naturalWidth === 0) {
      this.onMapError(mapId);
    }
  }
}
