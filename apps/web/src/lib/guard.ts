/**
 * Deployment guard: fail fast on origins this app must never run from.
 *
 * Vaultwarden's get_allowed_origin() only permits the vault's own configured
 * origin (plus file:// for the desktop bundle), so a copy of this static bundle
 * served from GitHub Pages or any other host cannot talk to a vault. CORS still
 * blocks cross-origin reads at the browser's request layer, but this guard
 * rejects insecure or unallowlisted deployments before any credential is sent.
 *
 * Rules:
 * - Opaque origins (`null`, file://) are never allowed.
 * - Only `https:`, or plain http on localhost for development, is allowed.
 * - When `VITE_TRUSTED_ORIGINS` is set (comma-separated), the page origin must
 *   be on that list. Unset means any https or localhost origin is accepted,
 *   because the page and `/api/v1` calls are same-origin by construction.
 */
function trustedOrigins(): string[] {
  const raw = import.meta.env['VITE_TRUSTED_ORIGINS'] as string | undefined;
  return (raw ?? '')
    .split(',')
    .map((candidate) => candidate.trim())
    .filter(Boolean);
}

export function describeOriginProblem(): string | null {
  let url: URL;
  try {
    url = new URL(window.location.href);
  } catch {
    return 'OxVault web is running from an unreadable page address.';
  }
  if (!url.origin || url.origin === 'null')
    return 'OxVault web cannot run from pages with an opaque origin.';
  const local = url.hostname === 'localhost' || url.hostname.endsWith('.localhost') ||
    url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  if (url.protocol !== 'https:' && !local)
    return 'OxVault web requires HTTPS, except on localhost during development.';
  const allowed = trustedOrigins();
  if (allowed.length > 0 && !allowed.includes(url.origin))
    return 'This site is not on the origins allowed for OxVault web.';
  return null;
}

/** Throws with a clear message when this deployment is not allowed. */
export function assertSameOrigin(): void {
  const problem = describeOriginProblem();
  if (problem) throw new Error(problem);
}
