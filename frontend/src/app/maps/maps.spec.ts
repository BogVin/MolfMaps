import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { ApiService } from '../core/api.service';
import { MapSummary } from '../core/api.types';
import { Maps } from './maps';

const FAVORITES_STORAGE_KEY = 'molfmaps.catalog.favorites';

const SEEDED: MapSummary = {
  id: 'a'.repeat(32),
  name: 'Kal Main Map',
  image_url: `/api/maps/${'a'.repeat(32)}/image`,
};

const SECOND_MAP: MapSummary = {
  id: 'b'.repeat(32),
  name: 'Mountain Pass',
  image_url: `/api/maps/${'b'.repeat(32)}/image`,
};

const THIRD_MAP: MapSummary = {
  id: 'c'.repeat(32),
  name: 'Alpine Ridge',
  image_url: `/api/maps/${'c'.repeat(32)}/image`,
};

function createComponent(
  authenticated: boolean,
  overrides: Partial<ApiService> = {},
): ComponentFixture<Maps> {
  const api = {
    getSession: () => of({ authenticated }),
    listMaps: () => of({ maps: [SEEDED] }),
    ...overrides,
  } as unknown as ApiService;

  TestBed.configureTestingModule({
    imports: [Maps],
    providers: [provideRouter([]), { provide: ApiService, useValue: api }],
  });

  const fixture = TestBed.createComponent(Maps);
  fixture.detectChanges();
  return fixture;
}

function addForm(fixture: ComponentFixture<Maps>): HTMLElement | null {
  return fixture.nativeElement.querySelector('.add-map-card');
}

function deleteButton(fixture: ComponentFixture<Maps>): HTMLButtonElement {
  return fixture.nativeElement.querySelector('.maps-list__delete');
}

function buttonWithText(fixture: ComponentFixture<Maps>, text: string): HTMLButtonElement {
  const buttons: HTMLButtonElement[] = Array.from(
    fixture.nativeElement.querySelectorAll('button'),
  );
  const match = buttons.find((button) => button.textContent?.trim() === text);
  if (!match) {
    throw new Error(`No button labelled "${text}"`);
  }
  return match;
}

function mapNames(fixture: ComponentFixture<Maps>): string[] {
  const links: NodeListOf<HTMLAnchorElement> =
    fixture.nativeElement.querySelectorAll('.maps-list__link');
  return Array.from(links, (link) => link.textContent?.trim() ?? '');
}

describe('Maps', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the add-map control for an authenticated session', () => {
    const fixture = createComponent(true);

    expect(addForm(fixture)).toBeTruthy();
  });

  it('hides the add-map control for an unauthenticated session', () => {
    const fixture = createComponent(false);

    expect(addForm(fixture)).toBeNull();
  });

  it('lists every map returned by the API', () => {
    const fixture = createComponent(false);

    const links: NodeListOf<HTMLAnchorElement> =
      fixture.nativeElement.querySelectorAll('.maps-list__link');
    expect(links.length).toBe(1);
    expect(links[0].textContent?.trim()).toBe('Kal Main Map');
  });

  it('filters maps by name without changing the catalog', () => {
    const fixture = createComponent(false, {
      listMaps: () => of({ maps: [SEEDED, SECOND_MAP] }),
    } as unknown as Partial<ApiService>);

    fixture.componentInstance.searchQuery.set('mountain');
    fixture.detectChanges();

    const links: NodeListOf<HTMLAnchorElement> =
      fixture.nativeElement.querySelectorAll('.maps-list__link');
    expect(Array.from(links, (link) => link.textContent?.trim())).toEqual(['Mountain Pass']);
    expect(fixture.componentInstance.maps()).toEqual([SEEDED, SECOND_MAP]);
  });

  it('shows a specific empty state when no map matches the search', () => {
    const fixture = createComponent(false);

    fixture.componentInstance.searchQuery.set('unknown');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.maps-list')).toBeNull();
    expect(fixture.nativeElement.querySelector('.maps-empty').textContent).toContain(
      'No maps match “unknown”.',
    );
  });

  it('shows the empty state when the catalog has no maps', () => {
    const fixture = createComponent(false, {
      listMaps: () => of({ maps: [] }),
    } as unknown as Partial<ApiService>);

    expect(fixture.nativeElement.querySelector('.maps-empty')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.maps-list')).toBeNull();
  });

  it('hides the delete control for an unauthenticated session', () => {
    const fixture = createComponent(false);

    expect(fixture.nativeElement.querySelector('.maps-list__delete')).toBeNull();
  });

  it('leaves the map in place when a delete is cancelled', () => {
    const deleteMap = vi.fn(() => of({ detail: 'Map deleted.' }));
    const fixture = createComponent(true, {
      deleteMap,
    } as unknown as Partial<ApiService>);

    deleteButton(fixture).click();
    fixture.detectChanges();
    buttonWithText(fixture, 'Cancel').click();
    fixture.detectChanges();

    expect(deleteMap).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('.maps-list__link').length).toBe(1);
    expect(deleteButton(fixture)).toBeTruthy();
  });

  it('prompts to log in again when the session expires mid-delete', () => {
    let authenticated = true;
    const fixture = createComponent(true, {
      getSession: () => of({ authenticated }),
      deleteMap: () => {
        authenticated = false;
        return throwError(
          () => new HttpErrorResponse({ status: 401, error: { detail: 'Authentication required.' } }),
        );
      },
    } as unknown as Partial<ApiService>);

    deleteButton(fixture).click();
    fixture.detectChanges();
    buttonWithText(fixture, 'Confirm').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Your session has expired.');
    expect(fixture.nativeElement.querySelector('.maps-list__delete')).toBeNull();
  });

  it('issues the delete request only after the confirmation step', () => {
    const deleteMap = vi.fn(() => of({ detail: 'Map deleted.' }));
    const fixture = createComponent(true, {
      deleteMap,
    } as unknown as Partial<ApiService>);

    deleteButton(fixture).click();
    fixture.detectChanges();

    expect(deleteMap).not.toHaveBeenCalled();

    buttonWithText(fixture, 'Confirm').click();

    expect(deleteMap).toHaveBeenCalledWith(SEEDED.id);
  });

  it('favorites a map and persists the favorite across reload', () => {
    const fixture = createComponent(false, {
      listMaps: () => of({ maps: [SEEDED, SECOND_MAP] }),
    } as unknown as Partial<ApiService>);

    buttonWithText(fixture, 'Favorite').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[aria-label="Unfavorite Kal Main Map"]')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) ?? '[]')).toEqual([SEEDED.id]);

    TestBed.resetTestingModule();
    const reloaded = createComponent(false, {
      listMaps: () => of({ maps: [SEEDED, SECOND_MAP] }),
    } as unknown as Partial<ApiService>);

    expect(
      reloaded.nativeElement.querySelector('[aria-label="Unfavorite Kal Main Map"]'),
    ).toBeTruthy();
  });

  it('filters to favorites only and shows a dedicated empty state', () => {
    const fixture = createComponent(false, {
      listMaps: () => of({ maps: [SEEDED, SECOND_MAP] }),
    } as unknown as Partial<ApiService>);

    buttonWithText(fixture, 'Favorites').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.maps-list')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No favorite maps yet.');

    buttonWithText(fixture, 'All maps').click();
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('[aria-label="Favorite Mountain Pass"]')
      .click();
    fixture.detectChanges();
    buttonWithText(fixture, 'Favorites').click();
    fixture.detectChanges();

    expect(mapNames(fixture)).toEqual(['Mountain Pass']);
  });

  it('sorts the visible list A–Z and Z–A', () => {
    const fixture = createComponent(false, {
      listMaps: () => of({ maps: [SEEDED, SECOND_MAP, THIRD_MAP] }),
    } as unknown as Partial<ApiService>);

    expect(mapNames(fixture)).toEqual(['Alpine Ridge', 'Kal Main Map', 'Mountain Pass']);

    buttonWithText(fixture, 'Sort Z–A').click();
    fixture.detectChanges();

    expect(mapNames(fixture)).toEqual(['Mountain Pass', 'Kal Main Map', 'Alpine Ridge']);
  });

  it('composes favorites filter with search and updates the result count', () => {
    const fixture = createComponent(false, {
      listMaps: () => of({ maps: [SEEDED, SECOND_MAP, THIRD_MAP] }),
    } as unknown as Partial<ApiService>);

    fixture.nativeElement
      .querySelector('[aria-label="Favorite Kal Main Map"]')
      .click();
    fixture.nativeElement
      .querySelector('[aria-label="Favorite Alpine Ridge"]')
      .click();
    fixture.detectChanges();
    buttonWithText(fixture, 'Favorites').click();
    fixture.componentInstance.searchQuery.set('kal');
    fixture.detectChanges();

    expect(mapNames(fixture)).toEqual(['Kal Main Map']);
    expect(fixture.nativeElement.textContent).toContain('Showing 1 of 3 maps');
  });

  it('resets search, filter, and sort without clearing favorites', () => {
    const fixture = createComponent(false, {
      listMaps: () => of({ maps: [SEEDED, SECOND_MAP, THIRD_MAP] }),
    } as unknown as Partial<ApiService>);

    fixture.nativeElement
      .querySelector('[aria-label="Favorite Mountain Pass"]')
      .click();
    fixture.detectChanges();
    buttonWithText(fixture, 'Favorites').click();
    buttonWithText(fixture, 'Sort Z–A').click();
    fixture.componentInstance.searchQuery.set('mountain');
    fixture.detectChanges();

    buttonWithText(fixture, 'Reset').click();
    fixture.detectChanges();

    expect(fixture.componentInstance.searchQuery()).toBe('');
    expect(fixture.componentInstance.catalogFilter()).toBe('all');
    expect(fixture.componentInstance.catalogSort()).toBe('name-asc');
    expect(mapNames(fixture)).toEqual(['Alpine Ridge', 'Kal Main Map', 'Mountain Pass']);
    expect(
      fixture.nativeElement.querySelector('[aria-label="Unfavorite Mountain Pass"]'),
    ).toBeTruthy();
  });
});
