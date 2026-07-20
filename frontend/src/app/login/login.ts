import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { ApiService } from '../core/api.service';

const GENERIC_ERROR = 'Invalid username or password.';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
})
export class Login implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  username = '';
  password = '';
  readonly error = signal('');
  readonly submitting = signal(false);
  readonly checkingSession = signal(true);

  ngOnInit(): void {
    this.api.getSession().subscribe({
      next: (session) => {
        if (session.authenticated) {
          void this.router.navigateByUrl('/');
          return;
        }
        this.checkingSession.set(false);
      },
      error: () => {
        this.checkingSession.set(false);
        this.error.set('Could not reach the server. Please try again.');
      },
    });
  }

  onSubmit(): void {
    this.error.set('');

    const username = this.username.trim();
    const password = this.password;

    if (!username || !password) {
      this.error.set('Please enter both a username and a password.');
      return;
    }

    this.submitting.set(true);
    this.api.login(username, password).subscribe({
      next: () => {
        void this.router.navigateByUrl('/');
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        if (err instanceof HttpErrorResponse && err.status === 401) {
          this.error.set(GENERIC_ERROR);
          return;
        }
        this.error.set('Something went wrong. Please try again.');
      },
    });
  }
}
