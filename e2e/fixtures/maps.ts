import type { APIRequestContext } from '@playwright/test';

import { adminCredentials } from './credentials';

/** Minimal valid PNG — the upload path sniffs real image bytes. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

export type CreatedMap = {
  id: string;
  name: string;
};

/** Sign in through the API so catalog writes do not go through the login form. */
export async function loginAdminApi(request: APIRequestContext): Promise<void> {
  const response = await request.post('/api/login', {
    data: {
      username: adminCredentials.username,
      password: adminCredentials.password,
    },
  });
  if (!response.ok()) {
    throw new Error(`Admin API login failed with status ${response.status()}`);
  }
}

export async function createCatalogMap(
  request: APIRequestContext,
  name: string,
): Promise<CreatedMap> {
  const response = await request.post('/api/maps', {
    multipart: {
      name,
      image: {
        name: 'map.png',
        mimeType: 'image/png',
        buffer: PNG_1X1,
      },
    },
  });
  if (!response.ok()) {
    throw new Error(
      `Create map failed with status ${response.status()}: ${await response.text()}`,
    );
  }
  const body = (await response.json()) as CreatedMap;
  return { id: body.id, name: body.name };
}

export async function deleteCatalogMap(
  request: APIRequestContext,
  id: string,
): Promise<void> {
  try {
    await request.delete(`/api/maps/${encodeURIComponent(id)}`);
  } catch {
    // Cleanup must not fail the test when the map is already gone.
  }
}

export function uniqueMapName(label: string): string {
  return `E2E ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
