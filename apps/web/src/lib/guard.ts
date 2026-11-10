/**
 * Deployment guard: fail fast on origins this app must never run from.
 *
 * OxVault web is a local TOTP authenticator with no server client.
 * It requires a secure deployment context:
 * - Opaque origins (null, file://) are rejected.
 * - Only https: or localhost / 127.0.0.1 is permitted.
 */

export function describeOriginProblem(customUrl?: string | URL | Location): string | null {
  // One source of truth for the opaque-origin message; README/docs quote it.
  const opaqueMessage =
    'OxVault web cannot run from an opaque origin (null). It requires HTTPS or localhost (e.g. https://vault.example.com or http://localhost:8000) under the /oxvault/ deploy path.';
  if (
    (typeof self !== 'undefined' && self.origin === 'null') ||
    (typeof window !== 'undefined' && window.origin === 'null')
  ) {
    return opaqueMessage;
  }

  let url: URL;
  try {
    if (customUrl instanceof URL) {
      url = customUrl;
    } else if (typeof customUrl === 'string') {
      if (customUrl === 'null') {
        return opaqueMessage;
      }
      url = new URL(customUrl);
    } else if (customUrl && 'href' in customUrl) {
      url = new URL(customUrl.href);
    } else if (typeof window !== 'undefined' && window.location?.href) {
      url = new URL(window.location.href);
    } else {
      return 'OxVault web is running from an unreadable page address.';
    }
  } catch {
    return 'OxVault web is running from an unreadable page address.';
  }

  if (
    !url.origin ||
    url.origin === 'null' ||
    url.protocol === 'file:' ||
    url.protocol === 'data:'
  ) {
    return opaqueMessage;
  }

  const local =
    url.hostname === 'localhost' ||
    url.hostname.endsWith('.localhost') ||
    url.hostname === '127.0.0.1' ||
    url.hostname === '[::1]';

  if (url.protocol !== 'https:' && !local) {
    return `OxVault web requires HTTPS (such as https://vault.example.com/oxvault/) or localhost (such as http://localhost:8000/oxvault/). Current origin '${url.origin}' is insecure. Deploy under https://${url.host}/oxvault/ or http://localhost:8000/oxvault/.`;
  }

  return null;
}

/** Throws with a clear message when this deployment is not allowed. */
export function assertSecureDeployment(customUrl?: string | URL | Location): void {
  const problem = describeOriginProblem(customUrl);
  if (problem) {
    throw new Error(problem);
  }
}
