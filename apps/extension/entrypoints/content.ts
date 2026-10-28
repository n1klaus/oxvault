import { defineContentScript } from 'wxt/utils/define-content-script';
import { startContent } from '../content';
import { EXTENSION_MATCHES } from '@oxvault/shared/browser-targets';
export default defineContentScript({
  matches: EXTENSION_MATCHES,
  allFrames: true,
  runAt: 'document_idle',
  main: startContent,
});
