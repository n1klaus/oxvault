import type { Result } from '@oxvault/shared/types';

export type TransportResult<T> = Result<T> | { ok: false; error: string; transport: true };

export function transportFailure<T>(error: string): TransportResult<T> {
  return { ok: false, error, transport: true };
}

export function shouldRetryTotp(
  attempt: number,
  response: { ok: boolean; transport?: true },
): boolean {
  return !response.ok && response.transport === true && attempt === 0;
}
