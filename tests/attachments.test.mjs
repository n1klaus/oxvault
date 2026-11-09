import { describe, expect, it } from 'vite-plus/test';
import {
  addAttachmentArgs,
  attachmentsOf,
  deleteAttachmentArgs,
  downloadAttachmentArgs,
} from '../apps/desktop/src/main/attachments.ts';

describe('attachmentsOf', () => {
  it('reads the CLI attachments array (id, fileName, size)', () => {
    const cipher = {
      id: 'item-1',
      attachments: [
        { id: 'att-1', fileName: 'backup-codes.txt', size: '2048' },
        { id: 'att-2', fileName: 'photo.jpg', size: '12345' },
      ],
    };
    expect(attachmentsOf(cipher)).toEqual([
      { id: 'att-1', fileName: 'backup-codes.txt', size: 2048 },
      { id: 'att-2', fileName: 'photo.jpg', size: 12345 },
    ]);
  });

  it('reads older cipher JSON, where attachment ids are top-level keys', () => {
    const cipher = {
      id: 'item-2',
      b857igwl1dzrs2: { fileName: 'photo.jpg', size: '12345' },
      name: 'A login',
    };
    expect(attachmentsOf(cipher)).toEqual([
      { id: 'b857igwl1dzrs2', fileName: 'photo.jpg', size: 12345 },
    ]);
  });

  it('reads a legacy top-level row carrying only name (name-only)', () => {
    expect(attachmentsOf({ b857igwl1dzrs2: { name: 'legacy.pdf', size: '10' } })).toEqual([
      { id: 'b857igwl1dzrs2', fileName: 'legacy.pdf', size: 10 },
    ]);
  });

  it('returns an empty list for an item with no attachments', () => {
    expect(attachmentsOf({ id: 'item-3', name: 'No files' })).toEqual([]);
  });

  it('reads null attachments as an empty list', () => {
    expect(attachmentsOf({ id: 'item-4', attachments: null })).toEqual([]);
  });

  it('skips malformed rows instead of throwing', () => {
    const cipher = {
      id: 'item-5',
      attachments: [
        { id: 'att-1', fileName: 'keep.txt', size: '10' },
        null,
        'not a row',
        { fileName: 'no id.txt', size: '1' },
      ],
    };
    expect(attachmentsOf(cipher)).toEqual([{ id: 'att-1', fileName: 'keep.txt', size: 10 }]);
  });

  it('falls back to the attachment id as the name when fileName is missing', () => {
    expect(attachmentsOf({ attachments: [{ id: 'att-9', size: '5' }] })).toEqual([
      { id: 'att-9', fileName: 'att-9', size: 5 },
    ]);
  });

  it('reads size 0 and non-numeric sizes without dropping the file', () => {
    expect(
      attachmentsOf({
        attachments: [
          { id: 'a', fileName: 'empty.txt', size: '0' },
          { id: 'b', fileName: 'odd.txt', size: 'unknown' },
        ],
      }),
    ).toEqual([
      { id: 'a', fileName: 'empty.txt', size: 0 },
      { id: 'b', fileName: 'odd.txt', size: 0 },
    ]);
  });
});

describe('bw attachment arguments', () => {
  it('downloads by attachment id with the item id', () => {
    expect(downloadAttachmentArgs('att-1', 'item-1', '/tmp/out')).toEqual([
      'get',
      'attachment',
      'att-1',
      '--itemid',
      'item-1',
      '--output',
      '/tmp/out',
    ]);
  });

  it('deletes by attachment id with the item id', () => {
    expect(deleteAttachmentArgs('att-1', 'item-1')).toEqual([
      'delete',
      'attachment',
      'att-1',
      '--itemid',
      'item-1',
    ]);
  });

  it('adds a file to the item', () => {
    expect(addAttachmentArgs('/tmp/in.pdf', 'item-1')).toEqual([
      'create',
      'attachment',
      '--file',
      '/tmp/in.pdf',
      '--itemid',
      'item-1',
    ]);
  });
});
