import type { StrongroomApi } from '@oxvault/shared/types';

declare global {
  interface Window {
    oxvault: StrongroomApi;
  }
}
