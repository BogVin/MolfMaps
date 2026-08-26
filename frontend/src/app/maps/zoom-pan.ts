/**
 * Zoom and pan state for the map view (research Decision 1).
 *
 * Pure state and arithmetic over three signals — `scale`, `offsetX`, `offsetY` —
 * projected into one CSS transform. Owning no DOM keeps the clamping rules
 * unit-testable, and applying a single composited transform is what keeps a
 * crowded map responsive: annotations are children of the transformed wrapper, so
 * one transform repositions all of them at once.
 *
 * Offsets are CSS pixels relative to the frame, and the transformed wrapper is
 * the frame's own size, so `scale = 1` is the map fitted to the viewport and its
 * offset is `(0, 0)`.
 */

import { computed, signal } from '@angular/core';

/** The map fitted to the viewport; zooming out can never go below it (FR-003). */
export const MIN_SCALE = 1.0;
export const MAX_SCALE = 8.0;

/** Multiplier for one discrete zoom action — a button press or a key (FR-003). */
export const ZOOM_STEP = 1.5;

export interface FrameSize {
  width: number;
  height: number;
}

export function clampScale(value: number): number {
  return Math.min(Math.max(value, MIN_SCALE), MAX_SCALE);
}

/**
 * Bound one axis so the scaled map always covers the frame (FR-004).
 *
 * Content larger than the frame may be dragged anywhere that keeps both its
 * edges outside; content that is not larger — only possible while fitted — is
 * pinned to the centre, which makes "cannot be dragged out of view" structural
 * rather than a heuristic.
 */
export function clampOffset(offset: number, frame: number, content: number): number {
  if (content <= frame) {
    return (frame - content) / 2;
  }
  return Math.min(0, Math.max(frame - content, offset));
}

export class ZoomPan {
  private readonly frame = signal<FrameSize>({ width: 0, height: 0 });

  /** The measured frame, which the view needs to fit the image inside it. */
  readonly frameSize = this.frame.asReadonly();

  readonly scale = signal(MIN_SCALE);
  readonly offsetX = signal(0);
  readonly offsetY = signal(0);

  readonly canZoomIn = computed(() => this.scale() < MAX_SCALE);
  readonly canZoomOut = computed(() => this.scale() > MIN_SCALE);
  readonly zoomed = computed(() => this.scale() > MIN_SCALE);

  readonly transform = computed(
    () =>
      `translate(${round(this.offsetX())}px, ${round(this.offsetY())}px) scale(${round(
        this.scale(),
      )})`,
  );

  /** Re-measured on viewport resize and device rotation, which re-clamps the offsets. */
  setFrameSize(size: FrameSize): void {
    this.frame.set(size);
    this.applyOffset(this.offsetX(), this.offsetY());
  }

  zoomIn(): void {
    this.zoomBy(ZOOM_STEP);
  }

  zoomOut(): void {
    this.zoomBy(1 / ZOOM_STEP);
  }

  /** Zoom about the centre of the frame, for buttons and keyboard actions. */
  zoomBy(factor: number): void {
    const { width, height } = this.frame();
    this.zoomToPointer(factor, width / 2, height / 2);
  }

  /**
   * Zoom about a point in frame coordinates, keeping the map point under it
   * stationary (FR-007).
   */
  zoomToPointer(factor: number, pointerX: number, pointerY: number): void {
    const current = this.scale();
    const next = clampScale(current * factor);
    if (next === current) {
      return;
    }
    const ratio = next / current;
    const nextX = pointerX - (pointerX - this.offsetX()) * ratio;
    const nextY = pointerY - (pointerY - this.offsetY()) * ratio;
    this.scale.set(next);
    this.applyOffset(nextX, nextY);
  }

  panBy(deltaX: number, deltaY: number): void {
    this.applyOffset(this.offsetX() + deltaX, this.offsetY() + deltaY);
  }

  /** Restore the whole map fitted to the viewport in one action (FR-005). */
  reset(): void {
    this.scale.set(MIN_SCALE);
    this.applyOffset(0, 0);
  }

  private applyOffset(x: number, y: number): void {
    const { width, height } = this.frame();
    const scale = this.scale();
    this.offsetX.set(clampOffset(x, width, width * scale));
    this.offsetY.set(clampOffset(y, height, height * scale));
  }
}

/** Keeps the transform string short without drifting from the stored value. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
