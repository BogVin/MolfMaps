/** API DTOs matching the FastAPI/OpenAPI contract. */

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

export interface MapSummary {
  id: string;
  title: string;
  image_url: string;
}

export interface MapsListResponse {
  maps: MapSummary[];
}

export interface ErrorResponse {
  detail: string;
}
