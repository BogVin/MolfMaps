import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { ApiService } from '../core/api.service';
import { MapSummary } from '../core/api.types';

const LOAD_ERROR = 'Could not load the maps. Please try again.';
const GENERIC_ERROR = 'Something went wrong. Please try again.';
const SESSION_EXPIRED = 'Your session has expired. Please log in again.';

@Component({
  selector: 'app-maps',
  imports: [FormsModule, RouterLink],
  templateUrl: './maps.html',
})
export class Maps implements OnInit {
  private readonly api = inject(ApiService);

  readonly maps = signal<MapSummary[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');

  readonly authenticated = signal(false);
  newMapName = '';
  private newMapFile: File | null = null;
  readonly addError = signal('');
  readonly addSuccess = signal('');
  readonly adding = signal(false);

  /** Id of the map whose row is currently showing the Confirm/Cancel step. */
  readonly pendingDeleteId = signal<string | null>(null);
  readonly deleteError = signal('');

  /** Shown outside the admin controls, which a 401 removes from the page. */
  readonly sessionNotice = signal('');

  ngOnInit(): void {
    this.refreshSession();
    this.loadMaps();
  }

  protected loadMaps(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.api.listMaps().subscribe({
      next: (response) => {
        this.maps.set(response.maps);
        this.loading.set(false);
      },
      error: () => {
        this.maps.set([]);
        this.loading.set(false);
        this.loadError.set(LOAD_ERROR);
      },
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.newMapFile = input.files?.[0] ?? null;
  }

  addMap(form: HTMLFormElement): void {
    this.addError.set('');
    this.addSuccess.set('');
    this.sessionNotice.set('');

    const name = this.newMapName.trim();
    if (!name) {
      this.addError.set('Please enter a display name for the map.');
      return;
    }
    if (!this.newMapFile) {
      this.addError.set('Please choose an image file for the map.');
      return;
    }

    this.adding.set(true);
    this.api.createMap(name, this.newMapFile).subscribe({
      next: (created) => {
        this.adding.set(false);
        this.newMapName = '';
        this.newMapFile = null;
        form.reset();
        this.addSuccess.set(`Added "${created.name}".`);
        this.loadMaps();
      },
      error: (err: unknown) => {
        this.adding.set(false);
        this.addError.set(this.messageFor(err));
      },
    });
  }

  askDelete(id: string): void {
    this.deleteError.set('');
    this.pendingDeleteId.set(id);
  }

  cancelDelete(): void {
    this.pendingDeleteId.set(null);
  }

  confirmDelete(id: string): void {
    this.deleteError.set('');
    this.sessionNotice.set('');
    this.api.deleteMap(id).subscribe({
      next: () => {
        this.pendingDeleteId.set(null);
        this.loadMaps();
      },
      error: (err: unknown) => {
        this.pendingDeleteId.set(null);
        this.deleteError.set(this.messageFor(err));
      },
    });
  }

  private messageFor(err: unknown): string {
    if (!(err instanceof HttpErrorResponse)) {
      return GENERIC_ERROR;
    }
    if (err.status === 401) {
      // The session expired mid-action: re-check it so the now-useless admin
      // controls disappear instead of silently failing on the next attempt.
      this.refreshSession();
      this.sessionNotice.set(SESSION_EXPIRED);
      return SESSION_EXPIRED;
    }
    // The server sends a user-safe `detail` for every rejection it defines.
    const detail = (err.error as { detail?: unknown } | null)?.detail;
    return typeof detail === 'string' && detail ? detail : GENERIC_ERROR;
  }

  private refreshSession(): void {
    this.api.getSession().subscribe({
      next: (session) => this.authenticated.set(session.authenticated),
      error: () => this.authenticated.set(false),
    });
  }
}
