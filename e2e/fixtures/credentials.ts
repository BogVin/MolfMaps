import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BACKEND_ENV_FILE = resolve(__dirname, '../../backend/.env');

/**
 * MolfMaps has a single admin whose credentials live in `backend/.env`, and no
 * registration endpoint — so E2E tests cannot create their own user. Read the
 * same file the backend reads instead of hardcoding credentials here.
 */
function readBackendEnv(): Record<string, string> {
  if (!existsSync(BACKEND_ENV_FILE)) {
    return {};
  }

  const parsed: Record<string, string> = {};
  for (const line of readFileSync(BACKEND_ENV_FILE, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) {
      continue;
    }
    parsed[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return parsed;
}

const backendEnv = readBackendEnv();

function requireCredential(name: string): string {
  const value = process.env[name] ?? backendEnv[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Set it in backend/.env or export it before running the E2E suite.`,
    );
  }
  return value;
}

export const adminCredentials = {
  get username(): string {
    return requireCredential('ADMIN_USERNAME');
  },
  get password(): string {
    return requireCredential('ADMIN_PASSWORD');
  },
};

/** Credentials that must never authenticate, used for the failure paths. */
export const rejectedCredentials = {
  unknownUsername: 'not-the-molfmaps-admin',
  wrongPassword: 'not-the-molfmaps-password',
};
