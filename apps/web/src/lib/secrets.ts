import { parseTotp, decodeBase32, type TotpAlgorithm } from '@oxvault/shared/totp';

export interface TotpEntry {
  id: string;
  label: string;
  entry: string;
  period: number;
  digits: number;
  algorithm: TotpAlgorithm;
  steam?: boolean;
}

// Re-export decodeBase32 and parseTotp for convenience
export { decodeBase32, parseTotp };

/**
 * Parse one or more TOTP entries from text (TOTP URIs, steam:// URIs, or bare base32 secrets).
 * Returns an array of parsed TotpEntry objects. Malformed entries or strings return an empty array.
 * Values are kept in-memory only and never persisted.
 */
export function addFromText(entry: string, label?: string): TotpEntry[] {
  if (!entry || typeof entry !== 'string') return [];
  const lines = entry
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const entries: TotpEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const params = parseTotp(line);
    if (!params) continue;

    let extractedLabel = '';
    try {
      const url = new URL(line);
      if (
        !url.protocol.toLowerCase().startsWith('otp') &&
        !url.protocol.toLowerCase().startsWith('steam')
      ) {
        // Not a TOTP/Steam URI — treat the whole line as a bare base32 secret.
        throw new Error('not a URI');
      }
      if (url.protocol.toLowerCase().startsWith('otp')) {
        // decodeURIComponent lives in its own scope: a malformed percent-escape
        // (e.g. "a%zz b") throws URIError, and that must NOT fall through to the
        // bare-base32 branch below — the line was meant to be a URI.
        let rawPath: string;
        try {
          rawPath = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
        } catch {
          return [];
        }
        const issuer = url.searchParams.get('issuer');
        if (rawPath && issuer && !rawPath.toLowerCase().startsWith(issuer.toLowerCase())) {
          extractedLabel = `${issuer}: ${rawPath}`;
        } else {
          extractedLabel = rawPath || issuer || '';
        }
      } else {
        extractedLabel = 'Steam';
      }
    } catch {
      // Not a URI — bare base32 secret
    }

    const resolvedLabel =
      // Multiline pastes: keep each line's own extracted label (issuer/label
      // from its URI); the explicit label arg only applies to lines with no
      // label of their own (bare secrets). Intentional asymmetry.
      lines.length > 1 && extractedLabel ? extractedLabel : label || extractedLabel || 'Untitled';

    entries.push({
      id: crypto.randomUUID(),
      label: resolvedLabel,
      entry: line,
      period: params.period,
      digits: params.digits,
      algorithm: params.algorithm,
      steam: params.steam,
    });
  }

  return entries;
}
