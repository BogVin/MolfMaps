import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { ApiService } from '../core/api.service';
import {
  Annotation,
  CreateAnnotationRequest,
  MapSummary,
  PoiAnnotation,
  PoiImage,
  UpdateAnnotationRequest,
} from '../core/api.types';
import {
  AnnotationDraft,
  AnnotationEditor,
  createDraft,
  draftFrom,
} from './annotation-editor';
import { AnnotationLayer, LabelPreview } from './annotation-layer';
import { PoiPopup } from './poi-popup';
import { FrameSize, ZoomPan } from './zoom-pan';

const NOT_FOUND = 'This map is no longer available.';
const LOAD_ERROR = 'Could not load this map. Please try again.';
const GENERIC_ERROR = 'Something went wrong. Please try again.';
const SESSION_EXPIRED = 'Your session has ended. Sign in again to keep editing.';

/** Keeps a popup anchored near a map edge from hanging off the frame. */
const POPUP_MARGIN = 12;

/** Continuous wheel zoom: one notch of a typical wheel is a gentle step. */
const WHEEL_SENSITIVITY = 0.0015;

/** How far one arrow-key press pans, in CSS pixels. */
const KEY_PAN_STEP = 60;

/**
 * A gesture counts as a placement only if the pointer barely moved and was down
 * briefly — otherwise it was a drag, which pans the map instead (FR-017).
 */
const PLACEMENT_MOVE_TOLERANCE = 5;
const PLACEMENT_TIME_LIMIT = 500;

/**
 * Exactly one of three states, so "only one placement mode at a time" cannot be
 * violated by any code path (research Decision 10).
 */
export type PlacementMode = 'off' | 'label' | 'poi';

interface GestureStart {
  x: number;
  y: number;
  time: number;
}

@Component({
  selector: 'app-map-view',
  imports: [RouterLink, AnnotationLayer, AnnotationEditor, PoiPopup],
  templateUrl: './map-view.html',
})
export class MapView implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly map = signal<MapSummary | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly imageFailed = signal(false);

  /** Per-visit view state only: never sent to the server, never persisted. */
  readonly zoom = new ZoomPan();

  readonly authenticated = signal(false);

  /** Always off when a map view opens, and never remembered (FR-012). */
  readonly placementMode = signal<PlacementMode>('off');

  readonly annotations = signal<Annotation[]>([]);

  /** Catalog maps offered as a text link's target; loaded only for an admin. */
  readonly targets = signal<MapSummary[]>([]);

  readonly draft = signal<AnnotationDraft | null>(null);
  readonly saving = signal(false);
  readonly saveError = signal('');

  /** The editor is standing by for a click to supply a new position (FR-040). */
  readonly awaitingMove = signal(false);

  /**
   * At most one popup is open, because the open one is identified rather than
   * tracked per marker — opening another cannot leave the first behind (FR-035).
   */
  readonly openPopupId = signal<string | null>(null);

  /** A one-off message over the map: a stale link, or a refused image. */
  readonly notice = signal('');

  /** Turns the notice into a prompt to sign in again (spec edge case). */
  readonly sessionExpired = signal(false);

  private readonly naturalSize = signal<FrameSize | null>(null);

  /**
   * The image's size once fitted to the frame, which is the box annotations are
   * positioned inside. Null until the image reports its intrinsic size, so the
   * media box falls back to the browser's own layout.
   */
  readonly fittedSize = computed<FrameSize | null>(() => {
    const natural = this.naturalSize();
    const frame = this.zoom.frameSize();
    if (!natural || !frame.width || !frame.height) {
      return null;
    }
    const fit = Math.min(frame.width / natural.width, frame.height / natural.height);
    return { width: natural.width * fit, height: natural.height * fit };
  });

  /** The unsaved label, drawn on the map so its size can be judged (FR-023). */
  readonly preview = computed<LabelPreview | null>(() => {
    const draft = this.draft();
    if (!draft || draft.kind !== 'text_link') {
      return null;
    }
    return { x: draft.x, y: draft.y, text: draft.text, textScale: draft.textScale };
  });

  /** Where to anchor the editor: the clicked map point, in frame coordinates. */
  readonly draftAnchor = computed<{ x: number; y: number } | null>(() => {
    const draft = this.draft();
    const fitted = this.fittedSize();
    if (!draft || !fitted) {
      return null;
    }
    return this.projectToFrame(draft.x, draft.y, fitted);
  });

  readonly openPopup = computed<PoiAnnotation | null>(() => {
    const id = this.openPopupId();
    const found = this.annotations().find((annotation) => annotation.id === id);
    return found?.kind === 'poi' ? found : null;
  });

  /**
   * The open popup's position in frame coordinates. Kept inside the frame so a
   * marker near an edge still shows a fully readable popup (spec edge case).
   */
  readonly popupAnchor = computed<{ x: number; y: number } | null>(() => {
    const point = this.openPopup();
    const fitted = this.fittedSize();
    if (!point || !fitted) {
      return null;
    }
    const frame = this.zoom.frameSize();
    const projected = this.projectToFrame(point.x, point.y, fitted);
    return {
      x: clamp(projected.x, POPUP_MARGIN, frame.width - POPUP_MARGIN),
      y: clamp(projected.y, POPUP_MARGIN, frame.height - POPUP_MARGIN),
    };
  });

  private readonly frameRef = viewChild<ElementRef<HTMLElement>>('frame');
  private readonly imageRef = viewChild<ElementRef<HTMLImageElement>>('mapImage');

  /** Live pointers on the map surface, so one drag pans and two pinch. */
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchDistance = 0;
  private gestureStart: GestureStart | null = null;

  constructor() {
    effect((onCleanup) => {
      const host = this.frameRef()?.nativeElement;
      if (!host) {
        return;
      }
      // Measuring writes the zoom signals, so keep it out of this effect's
      // dependencies — otherwise every pan would schedule another measurement.
      untracked(() => this.measureFrame(host));
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(() =>
        untracked(() => this.measureFrame(host)),
      );
      observer.observe(host);
      onCleanup(() => observer.disconnect());
    });
  }

  ngOnInit(): void {
    this.refreshSession();
    // Following a text link changes only the route parameter, so the view must
    // reload from the parameter rather than from a one-off snapshot.
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.openMap(params.get('id') ?? ''));
  }

  // --- Loading ---------------------------------------------------------------

  private openMap(id: string): void {
    this.resetView();
    this.api.getMap(id).subscribe({
      next: (map) => {
        this.map.set(map);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const notFound = err instanceof HttpErrorResponse && err.status === 404;
        this.loadError.set(notFound ? NOT_FOUND : LOAD_ERROR);
      },
    });
    this.reloadAnnotations(id);
  }

  private reloadAnnotations(mapId: string): void {
    this.api.listAnnotations(mapId).subscribe({
      next: (response) => this.annotations.set(response.annotations),
      error: () => this.annotations.set([]),
    });
  }

  private resetView(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.imageFailed.set(false);
    this.naturalSize.set(null);
    this.annotations.set([]);
    this.placementMode.set('off');
    this.draft.set(null);
    this.saveError.set('');
    this.notice.set('');
    this.sessionExpired.set(false);
    this.awaitingMove.set(false);
    this.openPopupId.set(null);
    this.zoom.reset();
  }

  private refreshSession(): void {
    this.api.getSession().subscribe({
      next: (session) => {
        this.authenticated.set(session.authenticated);
        if (session.authenticated) {
          this.loadTargets();
          if (this.sessionExpired()) {
            this.dismissNotice();
          }
        } else {
          this.placementMode.set('off');
          this.draft.set(null);
        }
      },
      error: () => this.authenticated.set(false),
    });
  }

  private loadTargets(): void {
    this.api.listMaps().subscribe({
      next: (response) => this.targets.set(response.maps),
      error: () => this.targets.set([]),
    });
  }

  onImageError(): void {
    this.imageFailed.set(true);
  }

  onImageLoad(img: HTMLImageElement): void {
    // Cached error: image finished loading as broken before/without error event.
    if (img.naturalWidth === 0) {
      this.imageFailed.set(true);
      return;
    }
    this.naturalSize.set({ width: img.naturalWidth, height: img.naturalHeight });
  }

  // --- Placement mode --------------------------------------------------------

  togglePlacement(mode: Exclude<PlacementMode, 'off'>): void {
    this.placementMode.update((current) => (current === mode ? 'off' : mode));
    this.draft.set(null);
    this.saveError.set('');
  }

  // --- Gestures --------------------------------------------------------------

  onPointerDown(event: PointerEvent): void {
    // Suppresses the browser's native image drag, which would otherwise cancel
    // the pan halfway through.
    event.preventDefault();
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    // Capturing keeps a drag alive past the frame's edge, so the release always
    // comes back here. Optional because not every environment implements it.
    this.frameRef()?.nativeElement.setPointerCapture?.(event.pointerId);
    // A second pointer means a pinch, which is never a placement.
    this.gestureStart =
      this.pointers.size === 1
        ? { x: event.clientX, y: event.clientY, time: Date.now() }
        : null;
    this.pinchDistance = this.currentPinchDistance();
  }

  onPointerMove(event: PointerEvent): void {
    const previous = this.pointers.get(event.pointerId);
    if (!previous) {
      return;
    }
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size >= 2) {
      this.applyPinch();
      return;
    }
    this.zoom.panBy(event.clientX - previous.x, event.clientY - previous.y);
  }

  onPointerUp(event: PointerEvent): void {
    const start = this.gestureStart;
    this.forgetPointer(event);
    if (start && this.wasClick(start, event)) {
      this.placeAt(event.clientX, event.clientY);
    }
  }

  onPointerCancel(event: PointerEvent): void {
    this.forgetPointer(event);
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const point = this.framePoint(event.clientX, event.clientY);
    this.zoom.zoomToPointer(
      Math.exp(-normalizeWheelDelta(event) * WHEEL_SENSITIVITY),
      point.x,
      point.y,
    );
  }

  onKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case '+':
      case '=':
        this.zoom.zoomIn();
        break;
      case '-':
      case '_':
        this.zoom.zoomOut();
        break;
      case '0':
        this.zoom.reset();
        break;
      case 'ArrowLeft':
        this.zoom.panBy(KEY_PAN_STEP, 0);
        break;
      case 'ArrowRight':
        this.zoom.panBy(-KEY_PAN_STEP, 0);
        break;
      case 'ArrowUp':
        this.zoom.panBy(0, KEY_PAN_STEP);
        break;
      case 'ArrowDown':
        this.zoom.panBy(0, -KEY_PAN_STEP);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  // --- Authoring -------------------------------------------------------------

  private placeAt(clientX: number, clientY: number): void {
    if (this.awaitingMove()) {
      this.moveDraftTo(clientX, clientY);
      return;
    }
    const mode = this.placementMode();
    // Nothing is created without an armed toggle, whoever the visitor is (FR-016).
    if (mode === 'off') {
      return;
    }
    // A second click while authoring would discard what has been typed.
    if (this.draft()) {
      return;
    }
    const point = this.imageFraction(clientX, clientY);
    if (!point) {
      return;
    }
    this.saveError.set('');
    this.draft.set(createDraft(mode === 'label' ? 'text_link' : 'poi', point.x, point.y));
  }

  private moveDraftTo(clientX: number, clientY: number): void {
    const point = this.imageFraction(clientX, clientY);
    if (!point) {
      return;
    }
    // The new spot is only staged; it reaches the server with the next save.
    this.draft.update((draft) => (draft ? { ...draft, x: point.x, y: point.y } : draft));
    this.awaitingMove.set(false);
  }

  onDraftChange(draft: AnnotationDraft): void {
    this.draft.set(draft);
  }

  onDraftSave(draft: AnnotationDraft): void {
    const map = this.map();
    if (!map) {
      return;
    }
    this.saving.set(true);
    this.saveError.set('');
    const saved = draft.id
      ? this.api.updateAnnotation(map.id, draft.id, updateBody(draft))
      : this.api.createAnnotation(map.id, createBody(draft));
    saved.subscribe({
      next: (annotation) => {
        this.saving.set(false);
        this.draft.set(null);
        // Shown at once, and the toggle stays armed for the next one (FR-019).
        this.annotations.update((current) =>
          draft.id
            ? current.map((item) => (item.id === annotation.id ? annotation : item))
            : [...current, annotation],
        );
        this.uploadPending(map.id, annotation.id, draft.pendingImages);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.failWrite(err);
      },
    });
  }

  onDraftCancel(): void {
    this.draft.set(null);
    this.awaitingMove.set(false);
    this.saveError.set('');
  }

  onDraftMove(): void {
    this.awaitingMove.set(true);
  }

  onDraftDelete(): void {
    const map = this.map();
    const id = this.draft()?.id;
    if (!map || !id) {
      return;
    }
    this.api.deleteAnnotation(map.id, id).subscribe({
      next: () => {
        this.draft.set(null);
        this.awaitingMove.set(false);
        this.annotations.update((current) => current.filter((item) => item.id !== id));
        if (this.openPopupId() === id) {
          this.openPopupId.set(null);
        }
      },
      error: (err: unknown) => this.failWrite(err),
    });
  }

  onDraftImageRemove(image: PoiImage): void {
    const map = this.map();
    const draft = this.draft();
    if (!map || !draft?.id) {
      return;
    }
    this.api.deleteAnnotationImage(map.id, draft.id, image.id).subscribe({
      next: () => {
        this.draft.update((current) =>
          current
            ? { ...current, images: current.images.filter((it) => it.id !== image.id) }
            : current,
        );
        this.reloadAnnotations(map.id);
      },
      error: (err: unknown) => this.failWrite(err),
    });
  }

  /**
   * A write refused for want of a session ends authoring outright: the toggles
   * and the editor go away and the admin is asked to sign in again, so nothing
   * half-written is left behind (spec edge case).
   */
  private failWrite(err: unknown): void {
    if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
      this.saveError.set(messageFor(err));
      return;
    }
    this.draft.set(null);
    this.awaitingMove.set(false);
    this.saveError.set('');
    this.sessionExpired.set(true);
    this.notice.set(SESSION_EXPIRED);
    // Re-checking is what actually removes the toggles, and it recovers
    // silently in the case where the session turned out to be valid after all.
    this.refreshSession();
  }

  /**
   * Attach the chosen files one at a time, now that the annotation they belong
   * to exists. A refused file is reported and skipped rather than undoing the
   * annotation, so the descriptive text is never lost to a bad image (FR-033).
   */
  private uploadPending(mapId: string, annotationId: string, files: File[]): void {
    if (!files.length) {
      return;
    }
    const failures: string[] = [];
    const upload = (index: number): void => {
      if (index >= files.length) {
        if (failures.length) {
          this.notice.set(failures.join(' '));
        }
        this.reloadAnnotations(mapId);
        return;
      }
      this.api.addAnnotationImage(mapId, annotationId, files[index]).subscribe({
        next: () => upload(index + 1),
        error: (err: unknown) => {
          if (err instanceof HttpErrorResponse && err.status === 401) {
            this.failWrite(err);
            this.reloadAnnotations(mapId);
            return;
          }
          failures.push(`${files[index].name}: ${messageFor(err)}`);
          upload(index + 1);
        },
      });
    };
    upload(0);
  }

  // --- Activation ------------------------------------------------------------

  onAnnotationActivate(annotation: Annotation): void {
    if (this.placementMode() !== 'off') {
      // FR-018: while a toggle is armed, this click neither stacks a new
      // annotation here, follows this one, nor opens its popup — it corrects it.
      this.saveError.set('');
      this.awaitingMove.set(false);
      this.draft.set(draftFrom(annotation));
      return;
    }
    if (annotation.kind === 'poi') {
      this.openPopupId.set(annotation.id);
      return;
    }
    if (!annotation.target_available) {
      this.notice.set(NOT_FOUND);
      return;
    }
    this.router.navigate(['/maps', annotation.target_map_id]);
  }

  dismissPopup(): void {
    // Only the popup closes: zoom and pan are untouched, so the map is left
    // exactly as the visitor had it (FR-035, SC-013).
    const closed = this.openPopupId();
    this.openPopupId.set(null);
    if (closed) {
      this.focusMarker(closed);
    }
  }

  /** Focus goes back where it came from, not to the top of the page (SC-016). */
  private focusMarker(annotationId: string): void {
    this.frameRef()
      ?.nativeElement.querySelector<HTMLElement>(
        `[data-annotation-id="${annotationId}"]`,
      )
      ?.focus();
  }

  dismissNotice(): void {
    this.notice.set('');
    this.sessionExpired.set(false);
  }

  // --- Geometry --------------------------------------------------------------

  private wasClick(start: GestureStart, event: PointerEvent): boolean {
    const movement = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    return (
      movement <= PLACEMENT_MOVE_TOLERANCE &&
      Date.now() - start.time <= PLACEMENT_TIME_LIMIT
    );
  }

  /** The clicked point as fractions of the map image, or null outside it. */
  private imageFraction(
    clientX: number,
    clientY: number,
  ): { x: number; y: number } | null {
    const rect = this.imageRef()?.nativeElement.getBoundingClientRect();
    if (!rect?.width || !rect.height) {
      return null;
    }
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) {
      return null;
    }
    return { x, y };
  }

  /**
   * Project a map point onto the frame, for the parts of the interface that sit
   * outside the transform and so must not be scaled by it.
   */
  private projectToFrame(
    x: number,
    y: number,
    fitted: FrameSize,
  ): { x: number; y: number } {
    const frame = this.zoom.frameSize();
    const scale = this.zoom.scale();
    const imageLeft = (frame.width - fitted.width) / 2;
    const imageTop = (frame.height - fitted.height) / 2;
    return {
      x: this.zoom.offsetX() + (imageLeft + x * fitted.width) * scale,
      y: this.zoom.offsetY() + (imageTop + y * fitted.height) * scale,
    };
  }

  private applyPinch(): void {
    const distance = this.currentPinchDistance();
    if (!this.pinchDistance || !distance) {
      this.pinchDistance = distance;
      return;
    }
    const midpoint = this.pinchMidpoint();
    const point = this.framePoint(midpoint.x, midpoint.y);
    this.zoom.zoomToPointer(distance / this.pinchDistance, point.x, point.y);
    this.pinchDistance = distance;
  }

  private currentPinchDistance(): number {
    const [first, second] = [...this.pointers.values()];
    if (!first || !second) {
      return 0;
    }
    return Math.hypot(second.x - first.x, second.y - first.y);
  }

  private pinchMidpoint(): { x: number; y: number } {
    const [first, second] = [...this.pointers.values()];
    return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  }

  private forgetPointer(event: PointerEvent): void {
    this.pointers.delete(event.pointerId);
    this.gestureStart = null;
    this.pinchDistance = this.currentPinchDistance();
  }

  private framePoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.frameRef()?.nativeElement.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  private measureFrame(host: HTMLElement): void {
    this.zoom.setFrameSize({ width: host.clientWidth, height: host.clientHeight });
  }
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), Math.max(low, high));
}

/** The wire payload for a draft, which the discriminated union splits by kind. */
function createBody(draft: AnnotationDraft): CreateAnnotationRequest {
  if (draft.kind === 'poi') {
    return { kind: 'poi', x: draft.x, y: draft.y, text: draft.text };
  }
  return {
    kind: 'text_link',
    x: draft.x,
    y: draft.y,
    text: draft.text,
    target_map_id: draft.targetMapId,
    text_scale: draft.textScale,
  };
}

/** Fields of the other kind must be omitted, not sent as empty (FR-039). */
function updateBody(draft: AnnotationDraft): UpdateAnnotationRequest {
  const changes: UpdateAnnotationRequest = {
    x: draft.x,
    y: draft.y,
    text: draft.text,
  };
  if (draft.kind === 'text_link') {
    changes.target_map_id = draft.targetMapId;
    changes.text_scale = draft.textScale;
  }
  return changes;
}

/** Wheel deltas arrive in pixels, lines, or pages; normalize them to pixels. */
function normalizeWheelDelta(event: WheelEvent): number {
  if (event.deltaMode === 1) {
    return event.deltaY * 16;
  }
  if (event.deltaMode === 2) {
    return event.deltaY * 400;
  }
  return event.deltaY;
}

/** The server sends a user-safe `detail` for every rejection it defines. */
function messageFor(err: unknown): string {
  if (!(err instanceof HttpErrorResponse)) {
    return GENERIC_ERROR;
  }
  const detail = (err.error as { detail?: unknown } | null)?.detail;
  return typeof detail === 'string' && detail ? detail : GENERIC_ERROR;
}
