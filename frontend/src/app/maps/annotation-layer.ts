/**
 * Renders a map's annotations over the image (research Decisions 2-3).
 *
 * The layer lives inside the transformed wrapper and is sized to the fitted
 * image, so positioning each annotation at `left: x%` / `top: y%` keeps it
 * anchored through zoom, pan, resize, and reload for free — the browser's own
 * layout plus one composited transform do the work.
 *
 * Pure presentation: it renders what it is given and reports activations.
 */

import { Component, computed, input, output } from '@angular/core';

import {
  Annotation,
  PoiAnnotation,
  RegionAppearance,
  RegionLinkAnnotation,
  TextLinkAnnotation,
} from '../core/api.types';
import { typefaceStack } from './typeface';

/** Enough of a marker's text to identify it without reading out a whole popup. */
const MARKER_LABEL_LENGTH = 60;

/** A label being authored, previewed on the map before it is saved (FR-023). */
export interface LabelPreview {
  x: number;
  y: number;
  text: string;
  textScale: number;
  color: string;
  typeface: string;
}

export interface RegionPreview {
  x: number;
  y: number;
  width: number;
  height: number;
  rest: RegionAppearance;
  hover: RegionAppearance;
  previewHover: boolean;
}

@Component({
  selector: 'app-annotation-layer',
  templateUrl: './annotation-layer.html',
  host: { class: 'annotation-layer' },
})
export class AnnotationLayer {
  readonly annotations = input<Annotation[]>([]);

  /** Fitted image width in CSS px — a label's font size is a fraction of it. */
  readonly imageWidth = input(0);

  /** Current zoom, which markers counter-scale by to keep one on-screen size. */
  readonly scale = input(1);

  readonly preview = input<LabelPreview | null>(null);
  readonly regionPreview = input<RegionPreview | null>(null);
  readonly authoring = input(false);

  /** The marker whose popup is open, so it can be shown as the active one. */
  readonly openPopupId = input<string | null>(null);

  /** A label being edited is drawn as the preview instead, never twice. */
  readonly editingId = input<string | null>(null);

  readonly activate = output<Annotation>();

  readonly textLinks = computed(() =>
    this.annotations().filter(
      (annotation): annotation is TextLinkAnnotation =>
        annotation.kind === 'text_link' && annotation.id !== this.editingId(),
    ),
  );

  readonly points = computed(() =>
    this.annotations().filter(
      (annotation): annotation is PoiAnnotation => annotation.kind === 'poi',
    ),
  );

  readonly regions = computed(() =>
    this.annotations().filter(
      (annotation): annotation is RegionLinkAnnotation =>
        annotation.kind === 'region_link' && annotation.id !== this.editingId(),
    ),
  );

  /** Map-relative sizing is what keeps a label proportional at every zoom (FR-027). */
  fontSize(textScale: number): number {
    return textScale * this.imageWidth();
  }

  fontFamily(typeface: string): string {
    return typefaceStack(typeface);
  }

  /**
   * Markers are the one thing that does *not* scale with the map: at 8× a scaled
   * marker would blanket the map, while a constant one stays a precise target
   * (research Decision 4).
   */
  counterScale(): number {
    return 1 / this.scale();
  }

  describe(link: TextLinkAnnotation): string {
    return link.target_available
      ? `${link.text} — opens the linked map`
      : `${link.text} — linked map is no longer available`;
  }

  describePoint(point: PoiAnnotation): string {
    const summary =
      point.text.length > MARKER_LABEL_LENGTH
        ? `${point.text.slice(0, MARKER_LABEL_LENGTH)}…`
        : point.text;
    return `Point of interest: ${summary}`;
  }

  describeRegion(region: RegionLinkAnnotation): string {
    return region.target_available
      ? 'Open the linked map'
      : 'Linked map is no longer available';
  }

  onActivate(event: Event, annotation: Annotation): void {
    // The map surface must never see this: while a placement toggle is armed the
    // same click would otherwise stack a new annotation on top of this one
    // (FR-018), and an unarmed drag would treat it as a pan.
    event.stopPropagation();
    this.activate.emit(annotation);
  }

  /**
   * Claim the gesture before it reaches the map surface, which is what decides
   * between placing an annotation and panning.
   */
  onPointerDown(event: PointerEvent): void {
    event.stopPropagation();
  }
}
