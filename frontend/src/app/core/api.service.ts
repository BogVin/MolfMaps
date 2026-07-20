import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  LoginResponse,
  MessageResponse,
  SessionResponse,
} from './api.types';

/**
 * Thin HttpClient wrappers around the MolfMaps REST API.
 * Credentials are included so the HttpOnly session cookie is sent/received.
 * Admin credentials are never embedded here — only submitted via login().
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  readonly mapUrl = '/api/map';

  private readonly http = inject(HttpClient);

  getSession(): Observable<SessionResponse> {
    return this.http.get<SessionResponse>('/api/session', {
      withCredentials: true,
    });
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      '/api/login',
      { username, password },
      { withCredentials: true },
    );
  }

  logout(): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      '/api/logout',
      {},
      { withCredentials: true },
    );
  }
}
