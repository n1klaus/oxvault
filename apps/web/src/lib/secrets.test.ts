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
      const entries = addFromText(uri);

      expect(entries).toHaveLength(1);
      expect(entries[0].label).toBe('Example: alice@google.com');
      expect(entries[0].period).toBe(60);
      expect(entries[0].digits).toBe(8);
      expect(entries[0].algorithm).toBe('SHA-256');
      expect(entries[0].steam).toBe(false);
      expect(typeof entries[0].id).toBe('string');
    });

    it('parses bare base32 secret into TotpEntry with optional label', () => {
      const entries = addFromText('JBSWY3DPEHPK3PXP', 'Custom Label');

      expect(entries).toHaveLength(1);
      expect(entries[0].label).toBe('Custom Label');
      expect(entries[0].period).toBe(30);
      expect(entries[0].digits).toBe(6);
      expect(entries[0].algorithm).toBe('SHA-1');
      expect(entries[0].steam).toBe(false);
    });

    it('defaults bare base32 secret label to Untitled when none provided', () => {
      const entries = addFromText('JBSWY3DPEHPK3PXP');

      expect(entries).toHaveLength(1);
      expect(entries[0].label).toBe('Untitled');
    });

    it('parses Steam URI into TotpEntry', () => {
      const entries = addFromText('steam://JBSWY3DPEHPK3PXP');

      expect(entries).toHaveLength(1);
      expect(entries[0].label).toBe('Steam');
      expect(entries[0].period).toBe(30);
      expect(entries[0].digits).toBe(5);
      expect(entries[0].steam).toBe(true);
    });

    it('returns empty array on malformed or empty string', () => {
      expect(addFromText('')).toEqual([]);
      expect(addFromText('   \n  \n  ')).toEqual([]);
      expect(addFromText('not-a-valid-secret-189')).toEqual([]);
      expect(addFromText(null as unknown as string)).toEqual([]);
    });

    it('rejects short base32-alphabet prose that decodes below the 80-bit key floor', () => {
      // 'not-a-secret' is base32-alphabet-clean after stripping '-' and would
      // previously parse as a 6-byte key — a working-looking fake entry.
      expect(addFromText('not-a-secret')).toEqual([]);
      // 16 base32 chars = 80 bits: still accepted.
      expect(addFromText('JBSWY3DPEHPK3PXP')).toHaveLength(1);
    });

    it('returns empty array for an otpauth URI with malformed percent-encoding', () => {
      // URIError from decodeURIComponent must not fall through to the
      // bare-base32 branch — the line was meant to be a URI.
      expect(addFromText('otpauth://totp/a%zz b?secret=JBSWY3DPEHPK3PXP')).toEqual([]);
    });

    it('keeps explicit label only for lines without their own label', () => {
      // Intentional asymmetry: multiline entries with extracted labels keep
      // them; the fallback label applies to bare lines only.
      const entries = addFromText(
        'otpauth://totp/A?secret=JBSWY3DPEHPK3PXP\nJBSWY3DPEHPK3PXP',
        'Fallback',
      );
      expect(entries[0].label).toBe('A');
      expect(entries[1].label).toBe('Fallback');
    });
  });
});
