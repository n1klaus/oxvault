import { describe, expect, it } from 'vite-plus/test';
import { Vault } from '../apps/desktop/src/main/vault.ts';
import { hasUsableTotp, totpDraftProblem, totpFromField } from '../packages/shared/src/totp.ts';
import { shouldRetryTotp } from '../apps/extension/lib/transport.ts';

const ITEM_ID = '11111111-1111-1111-1111-111111111111';
// Synthetic 10-byte base32 key; no real vault data or secret.
const SECRET = 'JBSWY3DPEHPK3PXP';
const login = (totp) => ({ username: 'alice', password: 'secret', uris: [], totp });
const baseItem = (extra = {}) => ({
  id: ITEM_ID,
  name: 'Bank',
  type: 1,
  login: login(SECRET),
  ...extra,
});

/** A CliPort that answers canned commands and records every call. */
function fakeCli(routes) {
  const calls = [];
  return {
    calls,
    cancel() {},
    async run(args, options) {
      calls.push({ args, options });
      const key = args.join(' ');
      for (const [pattern, handler] of routes) {
        if (pattern === key || (pattern instanceof RegExp && pattern.test(key))) {
          if (handler instanceof Error) throw handler;
          return typeof handler === 'function' ? handler(args, options) : handler;
        }
      }
      throw new Error(`unexpected command: ${key}`);
    },
  };
}

/** Drives a Vault to the unlocked state with `items` in the vault. */
async function unlockedVault(items, routes = []) {
  const cli = fakeCli([
    [
      'status',
      JSON.stringify({ status: 'locked', userEmail: 'a@b.c', serverUrl: 'https://vault' }),
    ],
    ['unlock --passwordenv OXVAULT_MASTER_PASSWORD --raw', 'session-key'],
    ['list items', JSON.stringify(items)],
    ...routes,
  ]);
  const vault = new Vault(cli);
  await vault.initialize();
  await vault.unlock('pw');
  return { cli, vault };
}

describe('TOTP handlers', () => {
  it('rejects a code read while the vault is locked', async () => {
    const cli = fakeCli([
      [
        'status',
        JSON.stringify({ status: 'locked', userEmail: 'a@b.c', serverUrl: 'https://vault' }),
      ],
    ]);
    const vault = new Vault(cli);
    await vault.initialize();
    await expect(vault.totp(ITEM_ID)).rejects.toThrow();
  });

  it('rejects a code read that was pending when the vault locked', async () => {
    const { vault } = await unlockedVault([baseItem()], [['lock', '']]);
    const pending = vault.totp(ITEM_ID);
    await vault.lock();
    await expect(pending).rejects.toThrow();
  });

  it('returns a code for a login with a usable key', async () => {
    const { vault } = await unlockedVault([baseItem()]);
    const code = await vault.totp(ITEM_ID);
    expect(code).toMatchObject({ period: 30 });
    expect(code.code).toMatch(/^\d{6}$/);
    expect(code.remaining).toBeGreaterThanOrEqual(1);
    expect(code.remaining).toBeLessThanOrEqual(30);
  });

  it('returns null when the stored key is not usable', async () => {
    const { vault } = await unlockedVault([baseItem({ login: login('not a real key') })]);
    await expect(vault.totp(ITEM_ID)).resolves.toBeNull();
  });

  it('withholds a reprompt key until opened and after the item closes', async () => {
    const full = { ...baseItem({ reprompt: 1 }) };
    const { cli, vault } = await unlockedVault(
      [full],
      [[`get item ${ITEM_ID}`, JSON.stringify(full)]],
    );
    cli.verifyPassword = async () => true;
    await expect(vault.totp(ITEM_ID)).resolves.toBeNull();
    await vault.openProtected(ITEM_ID, 'pw');
    await expect(vault.totp(ITEM_ID)).resolves.toMatchObject({ period: 30 });
    vault.closeProtected(ITEM_ID);
    await expect(vault.totp(ITEM_ID)).resolves.toBeNull();
  });

  it('returns a code for a trashed login and still blocks it for the browser', async () => {
    const trashed = { ...baseItem({ deletedDate: '2026-01-02T00:00:00.000Z' }) };
    const { vault } = await unlockedVault([], [['list items --trash', JSON.stringify([trashed])]]);
    await vault.trash();
    await expect(vault.totp(ITEM_ID)).resolves.toMatchObject({ period: 30 });
    expect(() => vault.requireBrowserItem(ITEM_ID)).toThrow();
  });

  it('keeps an unchanged legacy key verbatim and rejects a changed invalid key', async () => {
    const legacy = 'not a real key !!';
    const latest = {
      ...baseItem({ login: login(legacy), revisionDate: '2026-01-01T00:00:00.000Z' }),
    };
    const { cli, vault } = await unlockedVault(
      [latest],
      [
        [`get item ${ITEM_ID}`, JSON.stringify(latest)],
        [`edit item ${ITEM_ID}`, JSON.stringify(latest)],
      ],
    );
    const draft = {
      id: ITEM_ID,
      revisionDate: latest.revisionDate,
      type: 1,
      name: 'Bank',
      username: 'alice',
      password: 'secret',
      totp: legacy,
      uris: [],
      notes: '',
      favorite: false,
    };
    await vault.save(draft);
    const edit = cli.calls.find((call) => call.args[0] === 'edit' && call.args[1] === 'item');
    const payload = JSON.parse(Buffer.from(edit.options.input, 'base64').toString('utf8'));
    expect(payload.login.totp).toBe(legacy);

    const editsBefore = cli.calls.filter((call) => call.args[0] === 'edit').length;
    await expect(vault.save({ ...draft, totp: 'definitely ! invalid' })).rejects.toThrow();
    expect(cli.calls.filter((call) => call.args[0] === 'edit').length).toBe(editsBefore);
  });

  it('accepts a changed parseable key with outer whitespace and stores it as typed', async () => {
    const latest = { ...baseItem({ revisionDate: '2026-01-01T00:00:00.000Z' }) };
    const { cli, vault } = await unlockedVault(
      [latest],
      [
        [`get item ${ITEM_ID}`, JSON.stringify(latest)],
        [`edit item ${ITEM_ID}`, JSON.stringify(latest)],
      ],
    );
    const padded = ` ${SECRET}\n`;
    await vault.save({
      id: ITEM_ID,
      revisionDate: latest.revisionDate,
      type: 1,
      name: 'Bank',
      username: 'alice',
      password: 'secret',
      totp: padded,
      uris: [],
      notes: '',
      favorite: false,
    });
    const edit = cli.calls.find((call) => call.args[0] === 'edit' && call.args[1] === 'item');
    const payload = JSON.parse(Buffer.from(edit.options.input, 'base64').toString('utf8'));
    expect(payload.login.totp).toBe(padded);
  });
});

describe('generateTotp', () => {
  it('expires at the end of the code period', async () => {
    const now = 1_735_689_612_345;
    const code = await totpFromField(SECRET, now);
    const periodMs = 30_000;
    expect(code.expiresAt).toBe((Math.floor(now / periodMs) + 1) * periodMs);
    expect(code.expiresAt).toBeGreaterThan(now);
  });
});

describe('hasUsableTotp', () => {
  it('accepts a stored secret and rejects a key no parse can read', () => {
    expect(hasUsableTotp(SECRET)).toBe(true);
    expect(hasUsableTotp('not a real key !!')).toBe(false);
    expect(hasUsableTotp('')).toBe(false);
    expect(hasUsableTotp('   ')).toBe(false);
  });
});

describe('shouldRetryTotp', () => {
  it('retries one transport failure and nothing else', () => {
    expect(shouldRetryTotp(0, { ok: false, transport: true })).toBe(true);
    expect(shouldRetryTotp(1, { ok: false, transport: true })).toBe(false);
    expect(shouldRetryTotp(0, { ok: false })).toBe(false);
    expect(shouldRetryTotp(0, { ok: true })).toBe(false);
  });
});

describe('totpDraftProblem', () => {
  it('accepts empty, valid, and space-wrapped keys; rejects values no parse can read', () => {
    expect(totpDraftProblem('')).toBeNull();
    expect(totpDraftProblem(SECRET)).toBeNull();
    expect(totpDraftProblem(` ${SECRET}`)).toBeNull();
    expect(totpDraftProblem(`${SECRET}\n`)).toBeNull();
    const problem = totpDraftProblem('not a real key !');
    expect(typeof problem).toBe('string');
    expect(problem).not.toBe('');
  });
});
