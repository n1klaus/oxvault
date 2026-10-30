import type { VaultApi } from '@oxvault/shared/types';

declare global {
  interface Window {
    oxvault: VaultApi;
  }
}
