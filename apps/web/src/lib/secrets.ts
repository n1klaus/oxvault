import { parseTotp, decodeBase32, type TotpAlgorithm } from '@oxvault/shared/totp';

export interface TotpEntry {
  id: string;
  label: string;
  entry: string;
  period: number;
  digits: number;
  algorithm: TotpAlgorithm;
  steam?: boolean;
  /** Set when the paste contained URI lines rejected (e.g. secret too short). */
  skippedNote?: string;
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
  /** Lines that looked like entries but were rejected (e.g. short secrets). */
  const rejected: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const params = parseTotp(line);
    if (!params) {
      // A URI-shaped line that parseTotp rejected (e.g. secret below the
      // 80-bit floor) is a rejected entry, not a bare secret — remember it so
      // the caller can tell the user, instead of silently dropping it.
      if (/^(otpauth|steam):/i.test(line)) rejected.push(line);
      continue;
    }

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

  if (rejected.length > 0) {
    // Per-line feedback: surface rejected URI-shaped lines on the first valid
    // entry's label so the UI can show what was dropped. With no valid entries
    // the caller's existing empty-state error already covers it.
    const note = `${rejected.length} line${rejected.length > 1 ? 's' : ''} skipped (secret too short): ${rejected[0]}`;
    if (entries.length > 0) entries[0]!.skippedNote = note;
  }

  return entries;
}
