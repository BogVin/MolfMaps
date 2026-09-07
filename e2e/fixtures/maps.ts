import type { APIRequestContext } from '@playwright/test';

import { adminCredentials } from './credentials';

/** Same 1x1 PNG the backend unit tests use — the upload path sniffs real bytes. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

export type CreatedMap = {
  id: string;
  name: string;
};

/** Signs the API request context in as admin so it can create and delete maps. */
export async function loginAdminApi(request: APIRequestContext): Promise<void> {
  const response = await request.post('/api/login', {
    data: {
      username: adminCredentials.username,
      password: adminCredentials.password,
    },
  });
  if (!response.ok()) {
    throw new Error(`Admin API login failed with HTTP ${response.status()}`);
  }
}

export async function createMapViaApi(
  request: APIRequestContext,
  name: string,
): Promise<CreatedMap> {
  const response = await request.post('/api/maps', {
    multipart: {
      name,
      image: {
        name: 'map.png',
        mimeType: 'image/png',
        buffer: TINY_PNG,
      },
    },
  });
  if (!response.ok()) {
    throw new Error(`Create map "${name}" failed with HTTP ${response.status()}`);
  }
  return response.json();
}

export async function deleteMapViaApi(
  request: APIRequestContext,
  id: string,
): Promise<void> {
  const response = await request.delete(`/api/maps/${id}`);
  if (!response.ok() && response.status() !== 404) {
    throw new Error(`Delete map ${id} failed with HTTP ${response.status()}`);
  }
}
