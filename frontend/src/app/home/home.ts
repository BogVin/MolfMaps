import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
})
export class Home implements OnInit {
  private readonly api = inject(ApiService);

  readonly authenticated = signal(false);
  readonly sessionLoading = signal(true);
  readonly sessionError = signal('');

  ngOnInit(): void {
    this.refreshSession();
  }

  logout(): void {
    this.api.logout().subscribe({
      next: () => this.refreshSession(),
      error: () => {
        this.sessionError.set('Could not reach the server. Please try again.');
        this.refreshSession();
      },
    });
  }

  private refreshSession(): void {
    this.sessionLoading.set(true);
    this.sessionError.set('');
    this.api.getSession().subscribe({
      next: (session) => {
        this.authenticated.set(session.authenticated);
        this.sessionLoading.set(false);
      },
      error: () => {
        this.authenticated.set(false);
        this.sessionLoading.set(false);
        this.sessionError.set('Could not reach the server. Please try again.');
      },
    });
  }
}
