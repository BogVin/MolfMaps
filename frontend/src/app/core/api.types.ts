/** API DTOs matching contracts/openapi.yaml. */

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

export interface MapSummary {
  id: string;
  name: string;
  /** Relative URL for the image bytes; used verbatim, never composed. */
  image_url: string;
}

export interface MapListResponse {
  maps: MapSummary[];
}

/**
 * Annotations. The two kinds are one discriminated union on `kind`, mirroring the
 * backend contract, so narrowing on `kind` gives each variant its own fields.
 *
 * Positions (`x`, `y`) are fractions of the map image in [0, 1], never screen
 * pixels, so they stay anchored through zoom, pan, resize, and reload.
 */
interface AnnotationBase {
  id: string;
  map_id: string;
  x: number;
  y: number;
  created_at: string;
  updated_at: string;
}

export interface TextLinkAnnotation extends AnnotationBase {
  kind: 'text_link';
  text: string;
  target_map_id: string;
  /** Font size as a fraction of the map image's width, in [0.01, 0.10]. */
  text_scale: number;
  /** Computed server-side: false once the target map has been deleted. */
  target_available: boolean;
}

export interface PoiImage {
  id: string;
  /** Relative URL for the image bytes; used verbatim, never composed. */
  image_url: string;
}

export interface PoiAnnotation extends AnnotationBase {
  kind: 'poi';
  text: string;
  images: PoiImage[];
}

export type Annotation = TextLinkAnnotation | PoiAnnotation;

export interface AnnotationListResponse {
  annotations: Annotation[];
}

export type CreateAnnotationRequest =
  | {
      kind: 'text_link';
      x: number;
      y: number;
      text: string;
      target_map_id: string;
      /** Omit to accept the server default (0.03). */
      text_scale?: number;
    }
  | { kind: 'poi'; x: number; y: number; text: string };

/** Partial update covering edit, resize, and reposition. `kind` is immutable. */
export interface UpdateAnnotationRequest {
  x?: number;
  y?: number;
  text?: string;
  target_map_id?: string;
  text_scale?: number;
}
