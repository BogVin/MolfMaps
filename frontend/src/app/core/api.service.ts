import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  Annotation,
  AnnotationListResponse,
  CreateAnnotationRequest,
  LoginResponse,
  MapListResponse,
  MapSummary,
  MessageResponse,
  PoiImage,
  SessionResponse,
  UpdateAnnotationRequest,
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

  listMaps(): Observable<MapListResponse> {
    return this.http.get<MapListResponse>('/api/maps');
  }

  getMap(id: string): Observable<MapSummary> {
    return this.http.get<MapSummary>(`/api/maps/${encodeURIComponent(id)}`);
  }

  mapImageUrl(id: string): string {
    return `/api/maps/${encodeURIComponent(id)}/image`;
  }

  deleteMap(id: string): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(
      `/api/maps/${encodeURIComponent(id)}`,
      { withCredentials: true },
    );
  }

  createMap(name: string, file: File): Observable<MapSummary> {
    const body = new FormData();
    body.append('name', name);
    body.append('image', file);
    return this.http.post<MapSummary>('/api/maps', body, {
      withCredentials: true,
    });
  }

  /** Public: every visitor sees a map's annotations, signed in or not. */
  listAnnotations(mapId: string): Observable<AnnotationListResponse> {
    return this.http.get<AnnotationListResponse>(this.annotationsUrl(mapId));
  }

  createAnnotation(
    mapId: string,
    body: CreateAnnotationRequest,
  ): Observable<Annotation> {
    return this.http.post<Annotation>(this.annotationsUrl(mapId), body, {
      withCredentials: true,
    });
  }

  /** One call covers edit, resize, and reposition — each is a partial update. */
  updateAnnotation(
    mapId: string,
    annotationId: string,
    changes: UpdateAnnotationRequest,
  ): Observable<Annotation> {
    return this.http.patch<Annotation>(
      this.annotationUrl(mapId, annotationId),
      changes,
      { withCredentials: true },
    );
  }

  deleteAnnotation(mapId: string, annotationId: string): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(this.annotationUrl(mapId, annotationId), {
      withCredentials: true,
    });
  }

  addAnnotationImage(
    mapId: string,
    annotationId: string,
    file: File,
  ): Observable<PoiImage> {
    const body = new FormData();
    body.append('image', file);
    return this.http.post<PoiImage>(
      `${this.annotationUrl(mapId, annotationId)}/images`,
      body,
      { withCredentials: true },
    );
  }

  deleteAnnotationImage(
    mapId: string,
    annotationId: string,
    imageId: string,
  ): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(
      `${this.annotationUrl(mapId, annotationId)}/images/${encodeURIComponent(imageId)}`,
      { withCredentials: true },
    );
  }

  private annotationsUrl(mapId: string): string {
    return `/api/maps/${encodeURIComponent(mapId)}/annotations`;
  }

  private annotationUrl(mapId: string, annotationId: string): string {
    return `${this.annotationsUrl(mapId)}/${encodeURIComponent(annotationId)}`;
  }
}
