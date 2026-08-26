/**
 * The single open point-of-interest popup (research Decision 4).
 *
 * Rendered outside the transformed wrapper and positioned by the map view, so
 * its text stays a constant, legible size instead of being shrunk at low zoom
 * and blown up at high zoom.
 */

import {
  Component,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { PoiAnnotation } from '../core/api.types';

@Component({
  selector: 'app-poi-popup',
  templateUrl: './poi-popup.html',
  host: {
    class: 'poi-popup',
    role: 'dialog',
    tabindex: '-1',
    'aria-label': 'Point of interest',
    '(keydown.escape)': 'onDismiss()',
  },
})
export class PoiPopup {
  readonly annotation = input.required<PoiAnnotation>();

  readonly dismiss = output<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // Moving focus into the popup is what lets a keyboard user read it, and it
    // is why the map view can hand focus back to the marker on dismissal.
    afterNextRender(() => this.host.nativeElement.focus());
  }

  /** Images whose bytes never arrived; their text stays readable (FR-036). */
  private readonly broken = signal<ReadonlySet<string>>(new Set());

  isBroken(imageId: string): boolean {
    return this.broken().has(imageId);
  }

  onImageError(imageId: string): void {
    this.broken.update((current) => new Set(current).add(imageId));
  }

  /** A cached failure can load without ever firing `error`, hence the size check. */
  onImageLoad(imageId: string, img: HTMLImageElement): void {
    if (img.naturalWidth === 0) {
      this.onImageError(imageId);
    }
  }

  onDismiss(): void {
    this.dismiss.emit();
  }
}
