/**
 * The annotation authoring form (research Decision 11).
 *
 * The click on the map only chose the position; the author still supplies the
 * details here and confirms before anything is saved. The draft is a two-way
 * model so the map view can preview the label at its chosen size while it is
 * still being edited (FR-023).
 *
 * Chosen images are held on the draft rather than uploaded as they are picked,
 * because a point of interest has no id to attach them to until it is saved. The
 * map view uploads them once the annotation itself exists, which is also what
 * keeps a refused image from discarding the text (FR-033).
 */

import { Component, computed, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Annotation, MapSummary, PoiImage } from '../core/api.types';

/** Bounds mirroring the server's, so the slider cannot leave the saved range. */
export const MIN_TEXT_SCALE = 0.01;
export const MAX_TEXT_SCALE = 0.1;
export const DEFAULT_TEXT_SCALE = 0.03;
export const TEXT_SCALE_STEP = 0.005;

export const MAX_LABEL_TEXT_LENGTH = 120;
export const MAX_POI_TEXT_LENGTH = 2000;

export interface AnnotationDraft {
  /** Present only when correcting an annotation that is already saved. */
  id?: string;
  kind: 'text_link' | 'poi';
  /** Position as fractions of the map image, supplied by the click. */
  x: number;
  y: number;
  text: string;
  targetMapId: string;
  textScale: number;
  /** Images already stored on this annotation. */
  images: PoiImage[];
  /** Files chosen here, uploaded once the annotation itself is saved. */
  pendingImages: File[];
}

export function createDraft(
  kind: AnnotationDraft['kind'],
  x: number,
  y: number,
): AnnotationDraft {
  return {
    kind,
    x,
    y,
    text: '',
    targetMapId: '',
    textScale: DEFAULT_TEXT_SCALE,
    images: [],
    pendingImages: [],
  };
}

/** A draft prefilled from a saved annotation, for correcting it (FR-039). */
export function draftFrom(annotation: Annotation): AnnotationDraft {
  const common = {
    id: annotation.id,
    x: annotation.x,
    y: annotation.y,
    text: annotation.text,
    pendingImages: [],
  };
  if (annotation.kind === 'text_link') {
    return {
      ...common,
      kind: 'text_link',
      targetMapId: annotation.target_map_id,
      textScale: annotation.text_scale,
      images: [],
    };
  }
  return {
    ...common,
    kind: 'poi',
    targetMapId: '',
    textScale: DEFAULT_TEXT_SCALE,
    images: annotation.images,
  };
}

@Component({
  selector: 'app-annotation-editor',
  imports: [FormsModule],
  templateUrl: './annotation-editor.html',
})
export class AnnotationEditor {
  readonly draft = model.required<AnnotationDraft>();

  /** Candidate targets for a text link — every map in the catalog. */
  readonly targets = input<MapSummary[]>([]);
  readonly saving = input(false);

  /** A rejection the server described, shown verbatim beside the form. */
  readonly serverError = input('');

  readonly save = output<AnnotationDraft>();
  readonly cancel = output<void>();

  /** A stored image the author asked to detach, which the map view applies. */
  readonly imageRemove = output<PoiImage>();

  /** Hand the next map click back to the view as this annotation's new spot. */
  readonly move = output<void>();

  readonly remove = output<void>();

  readonly minTextScale = MIN_TEXT_SCALE;
  readonly maxTextScale = MAX_TEXT_SCALE;
  readonly textScaleStep = TEXT_SCALE_STEP;

  readonly isTextLink = computed(() => this.draft().kind === 'text_link');

  readonly isEditing = computed(() => Boolean(this.draft().id));

  /**
   * Deleting is permanent with no undo, so it takes two deliberate actions and
   * cancelling leaves the annotation exactly as it was (FR-041).
   */
  readonly confirmingDelete = signal(false);

  readonly maxTextLength = computed(() =>
    this.isTextLink() ? MAX_LABEL_TEXT_LENGTH : MAX_POI_TEXT_LENGTH,
  );

  readonly title = computed(() => {
    if (this.isTextLink()) {
      return this.isEditing() ? 'Edit this label' : 'Add a text label';
    }
    return this.isEditing() ? 'Edit this point of interest' : 'Add a point of interest';
  });

  /** Validation messages appear only once a save has been attempted. */
  private readonly submitted = signal(false);

  readonly textError = computed(() => {
    if (!this.submitted() || this.draft().text.trim()) {
      return '';
    }
    return this.isTextLink() ? 'Enter the label text.' : 'Enter a description.';
  });

  readonly targetError = computed(() =>
    this.submitted() && this.isTextLink() && !this.draft().targetMapId
      ? 'Choose the map this label opens.'
      : '',
  );

  onTextChange(text: string): void {
    this.draft.update((draft) => ({ ...draft, text }));
  }

  onTargetChange(targetMapId: string): void {
    this.draft.update((draft) => ({ ...draft, targetMapId }));
  }

  onTextScaleChange(value: string): void {
    const textScale = clampTextScale(Number(value));
    this.draft.update((draft) => ({ ...draft, textScale }));
  }

  onFilesChosen(input: HTMLInputElement): void {
    const chosen = Array.from(input.files ?? []);
    if (chosen.length) {
      this.draft.update((draft) => ({
        ...draft,
        pendingImages: [...draft.pendingImages, ...chosen],
      }));
    }
    // Cleared so re-picking the same file still counts as a change.
    input.value = '';
  }

  onRemovePending(index: number): void {
    this.draft.update((draft) => ({
      ...draft,
      pendingImages: draft.pendingImages.filter((_, at) => at !== index),
    }));
  }

  onRemoveImage(image: PoiImage): void {
    this.imageRemove.emit(image);
  }

  onSubmit(): void {
    this.submitted.set(true);
    if (this.textError() || this.targetError()) {
      return;
    }
    const draft = this.draft();
    this.save.emit({ ...draft, text: draft.text.trim() });
  }

  onMove(): void {
    this.move.emit();
  }

  onDeleteRequest(): void {
    this.confirmingDelete.set(true);
  }

  onDeleteCancel(): void {
    this.confirmingDelete.set(false);
  }

  onDeleteConfirm(): void {
    this.remove.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }
}

/** The slider stops at each bound rather than refusing the value (FR-024). */
export function clampTextScale(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_TEXT_SCALE;
  }
  return Math.min(Math.max(value, MIN_TEXT_SCALE), MAX_TEXT_SCALE);
}
