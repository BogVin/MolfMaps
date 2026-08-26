import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ApiService } from '../core/api.service';
import { MapSummary, TextLinkAnnotation } from '../core/api.types';
import { MapView } from './map-view';

const MAP: MapSummary = {
  id: 'a'.repeat(32),
  name: 'Kal Main Map',
  image_url: `/api/maps/${'a'.repeat(32)}/image`,
};

/** The image box the placement arithmetic converts a click against. */
const IMAGE_BOX = { left: 0, top: 0, width: 200, height: 100 };

const SAVED_LINK: TextLinkAnnotation = {
  id: 'b'.repeat(32),
  map_id: MAP.id,
  kind: 'text_link',
  x: 0.5,
  y: 0.5,
  text: 'North District',
  target_map_id: MAP.id,
  text_scale: 0.03,
  target_available: true,
  created_at: '2026-07-31T12:00:00+00:00',
  updated_at: '2026-07-31T12:00:00+00:00',
};

function createComponent(
  authenticated: boolean,
  overrides: Partial<ApiService> = {},
): ComponentFixture<MapView> {
  const api = {
    getSession: () => of({ authenticated }),
    getMap: () => of(MAP),
    listMaps: () => of({ maps: [MAP] }),
    listAnnotations: () => of({ annotations: [] }),
    ...overrides,
  } as unknown as ApiService;

  TestBed.configureTestingModule({
    imports: [MapView],
    providers: [provideRouter([]), { provide: ApiService, useValue: api }],
  });

  const fixture = TestBed.createComponent(MapView);
  fixture.detectChanges();
  return fixture;
}

function toggle(fixture: ComponentFixture<MapView>, kind: 'label' | 'poi'): HTMLButtonElement {
  const found = fixture.nativeElement.querySelector(`.map-toggle--${kind}`);
  if (!found) {
    throw new Error(`No ${kind} placement toggle rendered`);
  }
  return found as HTMLButtonElement;
}

function pressed(button: HTMLButtonElement): boolean {
  return button.getAttribute('aria-pressed') === 'true';
}

function query<T extends Element>(fixture: ComponentFixture<MapView>, selector: string): T {
  const found = fixture.nativeElement.querySelector(selector);
  if (!found) {
    throw new Error(`Nothing matched "${selector}"`);
  }
  return found as T;
}

/**
 * jsdom lays nothing out, so the image reports the box the placement arithmetic
 * would otherwise read from a real render.
 */
function stubImageBox(fixture: ComponentFixture<MapView>): void {
  const image = query<HTMLImageElement>(fixture, '.map-image');
  image.getBoundingClientRect = () =>
    ({ ...IMAGE_BOX, right: IMAGE_BOX.width, bottom: IMAGE_BOX.height, x: 0, y: 0 }) as DOMRect;
}

/** jsdom has no PointerEvent, but the handlers only read mouse-event fields. */
function pointer(type: string, clientX: number, clientY: number): MouseEvent {
  return new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true });
}

function tapMap(fixture: ComponentFixture<MapView>, x: number, y: number): void {
  const frame = query(fixture, '.map-frame');
  frame.dispatchEvent(pointer('pointerdown', x, y));
  frame.dispatchEvent(pointer('pointerup', x, y));
  fixture.detectChanges();
}

function dragMap(
  fixture: ComponentFixture<MapView>,
  from: [number, number],
  to: [number, number],
): void {
  const frame = query(fixture, '.map-frame');
  frame.dispatchEvent(pointer('pointerdown', ...from));
  frame.dispatchEvent(pointer('pointermove', ...to));
  frame.dispatchEvent(pointer('pointerup', ...to));
  fixture.detectChanges();
}

/**
 * `ngModel` wires its view-to-model pipeline in a microtask, so the form must be
 * given a chance to settle before its controls will report a change.
 */
async function fillEditor(
  fixture: ComponentFixture<MapView>,
  text: string,
  targetIndex = 1,
): Promise<void> {
  await fixture.whenStable();

  const input = query<HTMLInputElement>(fixture, '#annotation-text');
  input.value = text;
  input.dispatchEvent(new Event('input'));

  // Angular rewrites bound option values, so the target is chosen by position:
  // index 0 is the "Choose a map…" placeholder.
  const select = query<HTMLSelectElement>(fixture, '#annotation-target');
  select.selectedIndex = targetIndex;
  select.dispatchEvent(new Event('change'));

  fixture.detectChanges();
}

function submitEditor(fixture: ComponentFixture<MapView>): void {
  query(fixture, '.annotation-editor').dispatchEvent(
    new Event('submit', { bubbles: true, cancelable: true }),
  );
  fixture.detectChanges();
}

function editorOpen(fixture: ComponentFixture<MapView>): boolean {
  return fixture.nativeElement.querySelector('.annotation-editor') !== null;
}

describe('MapView placement toggles', () => {
  it('hides both toggles for an unauthenticated visitor', () => {
    const fixture = createComponent(false);

    expect(fixture.nativeElement.querySelectorAll('.map-toggle').length).toBe(0);
  });

  it('renders both toggles switched off for an authenticated user', () => {
    const fixture = createComponent(true);

    expect(fixture.nativeElement.querySelectorAll('.map-toggle').length).toBe(2);
    expect(pressed(toggle(fixture, 'label'))).toBe(false);
    expect(pressed(toggle(fixture, 'poi'))).toBe(false);
  });

  it('starts every fresh view with placement mode off', () => {
    const fixture = createComponent(true);

    expect(fixture.componentInstance.placementMode()).toBe('off');
  });

  it('disarms the other toggle when one is armed', () => {
    const fixture = createComponent(true);

    toggle(fixture, 'label').click();
    fixture.detectChanges();

    expect(fixture.componentInstance.placementMode()).toBe('label');
    expect(pressed(toggle(fixture, 'label'))).toBe(true);
    expect(pressed(toggle(fixture, 'poi'))).toBe(false);

    toggle(fixture, 'poi').click();
    fixture.detectChanges();

    expect(fixture.componentInstance.placementMode()).toBe('poi');
    expect(pressed(toggle(fixture, 'label'))).toBe(false);
    expect(pressed(toggle(fixture, 'poi'))).toBe(true);
  });

  it('returns to plain viewing when the armed toggle is switched off', () => {
    const fixture = createComponent(true);

    toggle(fixture, 'label').click();
    fixture.detectChanges();
    toggle(fixture, 'label').click();
    fixture.detectChanges();

    expect(fixture.componentInstance.placementMode()).toBe('off');
    expect(pressed(toggle(fixture, 'label'))).toBe(false);
  });
});

describe('MapView label placement', () => {
  function armed(overrides: Partial<ApiService> = {}): ComponentFixture<MapView> {
    const fixture = createComponent(true, overrides);
    stubImageBox(fixture);
    toggle(fixture, 'label').click();
    fixture.detectChanges();
    return fixture;
  }

  it('opens an editor anchored at the clicked map point', () => {
    const fixture = armed();

    tapMap(fixture, 100, 25);

    expect(editorOpen(fixture)).toBe(true);
    expect(fixture.componentInstance.draft()).toMatchObject({
      kind: 'text_link',
      x: 0.5,
      y: 0.25,
    });
  });

  it('creates nothing when no placement mode is active', () => {
    const fixture = createComponent(true);
    stubImageBox(fixture);

    tapMap(fixture, 100, 25);

    expect(editorOpen(fixture)).toBe(false);
    expect(fixture.componentInstance.draft()).toBeNull();
  });

  it('pans instead of placing when the gesture was a drag', () => {
    const fixture = armed();

    dragMap(fixture, [40, 40], [140, 90]);

    expect(editorOpen(fixture)).toBe(false);
    expect(fixture.componentInstance.draft()).toBeNull();
  });

  it('refuses to save without text or a target map, and posts nothing', () => {
    const createAnnotation = vi.fn(() => of(SAVED_LINK));
    const fixture = armed({ createAnnotation } as unknown as Partial<ApiService>);
    tapMap(fixture, 100, 50);

    submitEditor(fixture);

    expect(createAnnotation).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Enter the label text.');
    expect(fixture.nativeElement.textContent).toContain('Choose the map this label opens.');
    expect(editorOpen(fixture)).toBe(true);
  });

  it('saves the label, shows it at once, and leaves the toggle armed', async () => {
    const createAnnotation = vi.fn(() => of(SAVED_LINK));
    const fixture = armed({ createAnnotation } as unknown as Partial<ApiService>);
    tapMap(fixture, 100, 50);

    await fillEditor(fixture, 'North District');
    submitEditor(fixture);

    expect(createAnnotation).toHaveBeenCalledWith(MAP.id, {
      kind: 'text_link',
      x: 0.5,
      y: 0.5,
      text: 'North District',
      target_map_id: MAP.id,
      text_scale: 0.03,
    });
    expect(editorOpen(fixture)).toBe(false);
    expect(query(fixture, '.annotation-label').textContent?.trim()).toBe('North District');
    expect(fixture.componentInstance.placementMode()).toBe('label');
  });

  it('keeps the toggle armed and saves nothing when authoring is cancelled', () => {
    const createAnnotation = vi.fn(() => of(SAVED_LINK));
    const fixture = armed({ createAnnotation } as unknown as Partial<ApiService>);
    tapMap(fixture, 100, 50);

    query<HTMLButtonElement>(fixture, '.annotation-editor__actions .btn-secondary').click();
    fixture.detectChanges();

    expect(createAnnotation).not.toHaveBeenCalled();
    expect(editorOpen(fixture)).toBe(false);
    expect(fixture.componentInstance.placementMode()).toBe('label');
  });

  it('surfaces the size the author chose in the saved payload', async () => {
    const createAnnotation = vi.fn(() => of(SAVED_LINK));
    const fixture = armed({ createAnnotation } as unknown as Partial<ApiService>);
    tapMap(fixture, 100, 50);
    await fillEditor(fixture, 'North District');

    const slider = query<HTMLInputElement>(fixture, '#annotation-size');
    slider.value = '0.08';
    slider.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    submitEditor(fixture);

    expect(createAnnotation).toHaveBeenCalledWith(
      MAP.id,
      expect.objectContaining({ text_scale: 0.08 }),
    );
  });
});

describe('MapView text link activation', () => {
  it('shows the unavailable message instead of following a stale link', () => {
    const fixture = createComponent(false, {
      listAnnotations: () =>
        of({ annotations: [{ ...SAVED_LINK, target_available: false }] }),
    } as unknown as Partial<ApiService>);

    query<HTMLButtonElement>(fixture, '.annotation-label').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('This map is no longer available.');
  });

  it('renders existing labels for a visitor with no session', () => {
    const fixture = createComponent(false, {
      listAnnotations: () => of({ annotations: [SAVED_LINK] }),
    } as unknown as Partial<ApiService>);

    expect(query(fixture, '.annotation-label').textContent?.trim()).toBe('North District');
    expect(fixture.nativeElement.querySelectorAll('.map-toggle').length).toBe(0);
  });
});
