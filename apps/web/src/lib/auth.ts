import { assertSameOrigin } from './guard';
import type { LoginInput } from '@oxvault/shared/types';

/**
 * Unlock and fetch TOTP-bearing logins from the OxVault desktop app's IPC interface.
 *
 * This runs in a browser context loaded via HTTP from the vault server. It communicates
 * with the native messaging host installed by the OxVault extension/desktop app.
 */

export interface TotpCode {
  id: string;
  name: string;
  code: string;
  countdown: number;
  secret: string;
}

/**
 * Root of the vault API this page talks to.
 *
 * The page itself is a static bundle with no server: a vault server that serves
 * `/api/v1/*` next to these assets is required (see docs/PARITY.md, "Web vault").
 * When the API shares the page's origin, leave `VITE_API_BASE` empty; point it
 * at an explicit URL only when that server is trusted to allow this origin.
 */
const API_BASE =
  (import.meta.env['VITE_API_BASE'] as string | undefined)?.replace(/\/+$/, '') ?? '';

async function callJson(path: string, init: RequestInit): Promise<Response> {
  assertSameOrigin();
  const response = await fetch(`${API_BASE}${path}`, init);
  return response;
}

export async function unlock(input: LoginInput): Promise<string> {
  // Send unlock request to the vault server on the guarded origin
  const response = await callJson('/api/v1/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Unlock failed');
  }

  return response.text(); // Returns session key
}

export async function getTotpLogins(session: string): Promise<TotpCode[]> {
  const response = await callJson('/api/v1/items', {
    headers: {
      Authorization: `Bearer ${session}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch items');
  }

  const ciphers: any[] = await response.json();

  // Filter to only logins with TOTP (cipher.login.totp), compute codes
  return ciphers
    .filter((cipher) => cipher.type === 1 && cipher.login?.totp)
    .map((cipher) => ({
      id: cipher.id,
      name: cipher.name || 'Untitled',
      secret: cipher.login!.totp!,
      code: '', // Will be computed by client-side OTPAuth library
      countdown: 0, // Will be computed
    }));
}

export async function getState(): Promise<string> {
  const response = await callJson('/api/v1/state', {
    headers: {
      Authorization: `Bearer ${document.cookie.replace(/.*session=([^;]*).*/, '$1')}`,
    },
  });

  if (!response.ok) {
    throw new Error('Not unlocked');
  }

  return response.text();
}
