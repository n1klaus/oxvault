import { describe, expect, it } from 'vite-plus/test';
import { addFromText, decodeBase32, parseTotp } from './secrets';

describe('secrets', () => {
  describe('parseTotp', () => {
    it('parses an otpauth://totp/... URI with period, digits, and algorithm propagation', () => {
      const uri =
        'otpauth://totp/Example:alice@google.com?secret=JBSWY3DPEHPK3PXP&issuer=Example&period=60&digits=8&algorithm=SHA256';
      const params = parseTotp(uri);

      expect(params).not.toBeNull();
      expect(params?.period).toBe(60);
      expect(params?.digits).toBe(8);
      expect(params?.algorithm).toBe('SHA-256');
      expect(params?.steam).toBe(false);
      expect(params?.secret).toEqual(decodeBase32('JBSWY3DPEHPK3PXP'));
    });

    it('propagates SHA-512 algorithm correctly', () => {
      const uri = 'otpauth://totp/Test?secret=JBSWY3DPEHPK3PXP&algorithm=SHA512&digits=7&period=45';
      const params = parseTotp(uri);

      expect(params).not.toBeNull();
      expect(params?.period).toBe(45);
      expect(params?.digits).toBe(7);
      expect(params?.algorithm).toBe('SHA-512');
      expect(params?.steam).toBe(false);
    });

    it('parses a bare base32 secret with default parameters', () => {
      const params = parseTotp('JBSWY3DPEHPK3PXP');

      expect(params).not.toBeNull();
      expect(params?.period).toBe(30);
      expect(params?.digits).toBe(6);
      expect(params?.algorithm).toBe('SHA-1');
      expect(params?.steam).toBe(false);
      expect(params?.secret).toEqual(decodeBase32('JBSWY3DPEHPK3PXP'));
    });

    it('parses a Steam URI with 5 digits and steam flag', () => {
      const params = parseTotp('steam://JBSWY3DPEHPK3PXP');

      expect(params).not.toBeNull();
      expect(params?.period).toBe(30);
      expect(params?.digits).toBe(5);
      expect(params?.algorithm).toBe('SHA-1');
      expect(params?.steam).toBe(true);
      expect(params?.secret).toEqual(decodeBase32('JBSWY3DPEHPK3PXP'));
    });

    it('returns null on malformed strings', () => {
      expect(parseTotp('')).toBeNull();
      expect(parseTotp('   ')).toBeNull();
      expect(parseTotp('invalid-secret-890')).toBeNull();
      expect(parseTotp('otpauth://invalid/foo')).toBeNull();
      expect(parseTotp('otpauth://totp/foo?digits=3&secret=JBSWY3DPEHPK3PXP')).toBeNull();
    });
  });

  describe('addFromText', () => {
    it('parses otpauth URI into TotpEntry', () => {
      const uri =
        'otpauth://totp/alice@google.com?secret=JBSWY3DPEHPK3PXP&issuer=Example&period=60&digits=8&algorithm=SHA256';
      const result = addFromText(uri);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].label).toBe('Example: alice@google.com');
      expect(result.entries[0].period).toBe(60);
      expect(result.entries[0].digits).toBe(8);
      expect(result.entries[0].algorithm).toBe('SHA-256');
      expect(result.entries[0].steam).toBe(false);
      expect(typeof result.entries[0].id).toBe('string');
    });

    it('parses bare base32 secret into TotpEntry with optional label', () => {
      const result = addFromText('JBSWY3DPEHPK3PXP', 'Custom Label');

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].label).toBe('Custom Label');
      expect(result.entries[0].period).toBe(30);
      expect(result.entries[0].digits).toBe(6);
      expect(result.entries[0].algorithm).toBe('SHA-1');
      expect(result.entries[0].steam).toBe(false);
    });

    it('defaults bare base32 secret label to Untitled when none provided', () => {
      const result = addFromText('JBSWY3DPEHPK3PXP');

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].label).toBe('Untitled');
    });

    it('parses Steam URI into TotpEntry', () => {
      const result = addFromText('steam://JBSWY3DPEHPK3PXP');

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].label).toBe('Steam');
      expect(result.entries[0].period).toBe(30);
      expect(result.entries[0].digits).toBe(5);
      expect(result.entries[0].steam).toBe(true);
    });

    it('returns empty entries and no skipped lines for malformed or empty string', () => {
      expect(addFromText('')).toEqual({ entries: [], skipped: [] });
      expect(addFromText('   \n  \n  ')).toEqual({ entries: [], skipped: [] });
      expect(addFromText('not-a-valid-secret-189')).toEqual({ entries: [], skipped: [] });
      expect(addFromText(null as unknown as string)).toEqual({ entries: [], skipped: [] });
    });

    it('rejects short base32-alphabet prose that decodes below the 80-bit key floor', () => {
      // 'not-a-secret' is base32-alphabet-clean after stripping '-' and would
      // previously parse as a 6-byte key — a working-looking fake entry.
      expect(addFromText('not-a-secret').entries).toEqual([]);
      // 16 base32 chars = 80 bits: still accepted.
      expect(addFromText('JBSWY3DPEHPK3PXP').entries).toHaveLength(1);
    });

    it('applies the 80-bit floor to otpauth and steam URIs too', () => {
      // A URI whose secret decodes below 10 bytes is rejected, same as a bare
      // short secret — the prose-paste attack cannot route through URIs.
      expect(addFromText('otpauth://totp/x?secret=NOTASECRET').entries).toEqual([]);
      expect(addFromText('steam://NOTASECRET').entries).toEqual([]);
      expect(addFromText('otpauth://totp/x?secret=JBSWY3DPEHPK3PXP').entries).toHaveLength(1);
      expect(addFromText('steam://JBSWY3DPEHPK3PXP').entries).toHaveLength(1);
    });

    it('returns rejected URI lines without dropping valid siblings', () => {
      const result = addFromText(
        'otpauth://totp/good?secret=JBSWY3DPEHPK3PXP\notpauth://totp/bad?secret=NOTASECRET',
      );
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].label).toBe('good');
      expect(result.skipped).toEqual(['otpauth://totp/bad?secret=NOTASECRET']);
    });

    it('returns rejected URI lines even when no entries parse', () => {
      const result = addFromText('otpauth://totp/bad?secret=NOTASECRET');
      expect(result.entries).toEqual([]);
      expect(result.skipped).toEqual(['otpauth://totp/bad?secret=NOTASECRET']);
    });

    it('reports a malformed percent-encoding URI as skipped, not silently dropped', () => {
      // URIError from decodeURIComponent must not fall through to the
      // bare-base32 branch — the line was meant to be a URI.
      const line = 'otpauth://totp/a%zz b?secret=JBSWY3DPEHPK3PXP';
      expect(addFromText(line)).toEqual({ entries: [], skipped: [line] });
    });

    it('keeps valid siblings when one URI line has a malformed percent-escape', () => {
      const bad = 'otpauth://totp/a%zz b?secret=JBSWY3DPEHPK3PXP';
      const result = addFromText(
        `otpauth://totp/one?secret=JBSWY3DPEHPK3PXP\n${bad}\notpauth://totp/three?secret=JBSWY3DPEHPK3PXP`,
      );
      expect(result.entries.map((e) => e.label)).toEqual(['one', 'three']);
      expect(result.skipped).toEqual([bad]);
    });

    it('keeps explicit label only for lines without their own label', () => {
      // Intentional asymmetry: multiline entries with extracted labels keep
      // them; the fallback label applies to bare lines only.
      const result = addFromText(
        'otpauth://totp/A?secret=JBSWY3DPEHPK3PXP\nJBSWY3DPEHPK3PXP',
        'Fallback',
      );
      expect(result.entries[0].label).toBe('A');
      expect(result.entries[1].label).toBe('Fallback');
    });
  });
});
