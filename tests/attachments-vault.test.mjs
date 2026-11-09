import { describe, expect, it } from 'vite-plus/test';
import { Vault } from '../apps/desktop/src/main/vault.ts';

const ITEM_ID = '11111111-1111-1111-1111-111111111111';
const baseItem = () => ({
  id: ITEM_ID,
  name: 'Bank',
  type: 1,
  login: { username: 'alice', password: 'secret', uris: [] },
});
const attached = (id, fileName, size) => ({
  ...baseItem(),
  attachments: [{ id, fileName, size }],
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

describe('attachment handlers', () => {
  it('refuses while the vault is locked', async () => {
    const cli = fakeCli([
      [
        'status',
        JSON.stringify({ status: 'locked', userEmail: 'a@b.c', serverUrl: 'https://vault' }),
      ],
    ]);
    const vault = new Vault(cli);
    await vault.initialize();
    await expect(vault.addAttachment(ITEM_ID, async () => '/tmp/x.pdf')).rejects.toThrow(
      'Unlock OxVault to continue.',
    );
  });

  it('adds a file with the item id and returns the refreshed item', async () => {
    const { cli, vault } = await unlockedVault(
      [baseItem()],
      [
        [/^create attachment/, ''],
        [`get item ${ITEM_ID}`, JSON.stringify(attached('att-1', 'codes.txt', '10'))],
      ],
    );
    const detail = await vault.addAttachment(ITEM_ID, async () => '/tmp/x.pdf');
    const create = cli.calls.find((call) => call.args[0] === 'create');
    expect(create.args).toEqual([
      'create',
      'attachment',
      '--file',
      '/tmp/x.pdf',
      '--itemid',
      ITEM_ID,
    ]);
    expect(detail.attachments).toEqual([{ id: 'att-1', fileName: 'codes.txt', size: 10 }]);
  });

  it('resolves null when the file picker is cancelled, without calling bw', async () => {
    const { cli, vault } = await unlockedVault([baseItem()]);
    await expect(vault.addAttachment(ITEM_ID, async () => null)).resolves.toBeNull();
    expect(cli.calls.some((call) => call.args[0] === 'create')).toBe(false);
  });

  it('refuses when the item is trashed while the file picker is open', async () => {
    const { vault } = await unlockedVault(
      [baseItem()],
      [
        [/^create attachment/, ''],
        [/^delete item/, ''],
      ],
    );
    await expect(
      vault.addAttachment(ITEM_ID, async () => {
        await vault.remove(ITEM_ID);
        return '/tmp/x.pdf';
      }),
    ).rejects.toThrow('Update this item in the official Bitwarden client.');
  });

  it('reports one generic message when the server refuses the attachment', async () => {
    const { vault } = await unlockedVault(
      [baseItem()],
      [[/^create attachment/, new Error('bw: you need premium; item 1111 secret-value')]],
    );
    const error = await vault.addAttachment(ITEM_ID, async () => '/tmp/x.pdf').catch((e) => e);
    expect(error.message).toBe(
      'Bitwarden did not accept the attachment. Your plan or server may not allow it.',
    );
    expect(/premium|secret-value/.test(error.message)).toBe(false);
  });

  it('refuses an item that asks for the master password and was not opened', async () => {
    const { vault } = await unlockedVault([{ ...baseItem(), reprompt: 1 }]);
    await expect(vault.deleteAttachment(ITEM_ID, 'att-1')).rejects.toThrow(
      'Update this item in the official Bitwarden client.',
    );
  });

  it('surfaces a legacy top-level attachment row in the item detail (legacy-detail)', async () => {
    const { vault } = await unlockedVault([
      { ...baseItem(), b857igwl1dzrs2: { fileName: 'legacy.pdf', size: '10' } },
    ]);
    expect(vault.detail(ITEM_ID).attachments).toEqual([
      { id: 'b857igwl1dzrs2', fileName: 'legacy.pdf', size: 10 },
    ]);
  });

  it('surfaces a legacy top-level row carrying only name in the item detail (name-only)', async () => {
    const { vault } = await unlockedVault([
      { ...baseItem(), b857igwl1dzrs2: { name: 'legacy.pdf', size: '10' } },
    ]);
    expect(vault.detail(ITEM_ID).attachments).toEqual([
      { id: 'b857igwl1dzrs2', fileName: 'legacy.pdf', size: 10 },
    ]);
  });

  it('downloads and deletes from the opened copy on an opened re-prompt item (opened-reprompt)', async () => {
    const cipher = {
      ...baseItem(),
      reprompt: 1,
      attachments: [{ id: 'att-1', fileName: 'codes.txt', size: '10' }],
    };
    const { cli, vault } = await unlockedVault(
      [cipher],
      [
        [/^get attachment att-1 --itemid/, ''],
        [/^delete attachment att-1 --itemid/, ''],
        [`get item ${ITEM_ID}`, JSON.stringify(cipher)],
      ],
    );
    cli.verifyPassword = async () => true;
    await vault.openProtected(ITEM_ID, 'pw');
    await expect(
      vault.downloadAttachment(ITEM_ID, 'att-1', async () => '/tmp/codes.txt'),
    ).resolves.toBe(true);
    await expect(vault.deleteAttachment(ITEM_ID, 'att-1')).resolves.toBeDefined();
    const download = cli.calls.find(
      (call) => call.args[0] === 'get' && call.args[1] === 'attachment',
    );
    expect(download.args).toEqual([
      'get',
      'attachment',
      'att-1',
      '--itemid',
      ITEM_ID,
      '--output',
      '/tmp/codes.txt',
    ]);
    const remove = cli.calls.find(
      (call) => call.args[0] === 'delete' && call.args[1] === 'attachment',
    );
    expect(remove.args).toEqual(['delete', 'attachment', 'att-1', '--itemid', ITEM_ID]);
  });

  it('downloads one attachment by its own id with the item id', async () => {
    const { cli, vault } = await unlockedVault(
      [attached('att-7', 'photo.jpg', '20')],
      [[/^get attachment att-7 --itemid/, '']],
    );
    await expect(
      vault.downloadAttachment(ITEM_ID, 'att-7', async () => '/tmp/photo.jpg'),
    ).resolves.toBe(true);
    const download = cli.calls.find(
      (call) => call.args[0] === 'get' && call.args[1] === 'attachment',
    );
    expect(download.args).toEqual([
      'get',
      'attachment',
      'att-7',
      '--itemid',
      ITEM_ID,
      '--output',
      '/tmp/photo.jpg',
    ]);
  });

  it('resolves null when the save dialog is cancelled', async () => {
    const { cli, vault } = await unlockedVault([attached('att-7', 'photo.jpg', '2')]);
    await expect(vault.downloadAttachment(ITEM_ID, 'att-7', async () => null)).resolves.toBeNull();
    expect(cli.calls.some((call) => call.args[0] === 'get' && call.args[1] === 'attachment')).toBe(
      false,
    );
  });

  it('rejects an attachment id the item does not have', async () => {
    const { vault } = await unlockedVault([baseItem()]);
    await expect(
      vault.downloadAttachment(ITEM_ID, 'att-none', async () => '/tmp/x'),
    ).rejects.toThrow('That file is no longer attached to this item.');
  });

  it('deletes an attachment and returns the refreshed item', async () => {
    const { cli, vault } = await unlockedVault(
      [attached('att-1', 'codes.txt', '10')],
      [
        [/^delete attachment att-1 --itemid/, ''],
        [`get item ${ITEM_ID}`, JSON.stringify(baseItem())],
      ],
    );
    const detail = await vault.deleteAttachment(ITEM_ID, 'att-1');
    const remove = cli.calls.find((call) => call.args[0] === 'delete');
    expect(remove.args).toEqual(['delete', 'attachment', 'att-1', '--itemid', ITEM_ID]);
    expect(detail.attachments).toEqual([]);
  });

  it('reports the save failure with one generic message', async () => {
    const { vault } = await unlockedVault(
      [attached('att-7', 'photo.jpg', '20')],
      [[/^get attachment/, new Error('bw: disk secret-path error')]],
    );
    await expect(
      vault.downloadAttachment(ITEM_ID, 'att-7', async () => '/tmp/photo.jpg'),
    ).rejects.toThrow('Bitwarden could not save that file.');
  });
});
