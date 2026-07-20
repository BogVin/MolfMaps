/** API DTOs matching contracts/openapi.yaml (unchanged from 001). */

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  authenticated: true;
}

export interface SessionResponse {
  authenticated: boolean;
}

export interface MessageResponse {
  detail: string;
}

export interface ErrorResponse {
  detail: string;
}
