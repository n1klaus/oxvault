import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vite-plus/test';
import { Attachments } from '../apps/desktop/src/renderer/Attachments.tsx';

const item = (overrides = {}) => ({
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Bank',
  type: 1,
  editable: true,
  restorable: false,
  attachments: [
    { id: 'att-1', fileName: 'backup-codes.txt', size: 2048 },
    { id: 'att-2', fileName: 'photo.jpg', size: 12345 },
  ],
  ...overrides,
});

const render = (overrides, onUpdated = () => {}) =>
  renderToStaticMarkup(createElement(Attachments, { item: item(overrides), onUpdated }));

describe('Attachments panel', () => {
  it('lists every file with a labelled download action', () => {
    const html = render();
    expect(html).toContain('backup-codes.txt');
    expect(html).toContain('photo.jpg');
    expect(html).toContain('aria-label="Download backup-codes.txt"');
    expect(html).toContain('aria-label="Download photo.jpg"');
  });

  it('offers to add a file for an item in the vault', () => {
    expect(render()).toContain('Add attachment');
  });

  it('offers no add or delete action for an item in the trash', () => {
    const html = render({ restorable: true });
    expect(html).toContain('backup-codes.txt');
    expect(html).not.toContain('Add attachment');
    expect(html).not.toContain('aria-label="Delete backup-codes.txt"');
    expect(html).toContain('aria-label="Download backup-codes.txt"');
  });

  it('offers no add or delete action for an item OxVault cannot edit', () => {
    const html = render({ editable: false });
    expect(html).toContain('backup-codes.txt');
    expect(html).not.toContain('Add attachment');
    expect(html).not.toContain('aria-label="Delete backup-codes.txt"');
  });

  it('labels the delete action for each file when the item can be edited', () => {
    const html = render();
    expect(html).toContain('aria-label="Delete backup-codes.txt"');
    expect(html).toContain('aria-label="Delete photo.jpg"');
  });

  it('renders nothing for an item with no attachments in the trash', () => {
    expect(render({ attachments: [], restorable: true })).toBe('');
  });
});
