import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { ApiService } from '../core/api.service';
import { MapSummary } from '../core/api.types';
import { Maps } from './maps';

const SEEDED: MapSummary = {
  id: 'a'.repeat(32),
  name: 'Kal Main Map',
  image_url: `/api/maps/${'a'.repeat(32)}/image`,
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

describe('Maps', () => {
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
});
