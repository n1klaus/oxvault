import type { AttachmentFile } from '@oxvault/shared/types';

/**
 * Attachment metadata as the Bitwarden CLI reports it. Current CLI versions put
 * the rows in an `attachments` array; older ones keyed each row by its
 * attachment id at the top level of the item JSON. Both shapes are read here.
 */
type CliAttachment = Record<string, unknown>;

function readSize(value: unknown): number {
  const size = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(size) && size > 0 ? size : 0;
}

function readFile(id: unknown, row: CliAttachment): AttachmentFile | null {
  if (typeof id !== 'string' || !id) return null;
  const name =
    typeof row.fileName === 'string' && row.fileName
      ? row.fileName
      : typeof row.name === 'string' && row.name
        ? row.name
        : id;
  return { id, fileName: name, size: readSize(row.size) };
}

/** Reads the files attached to one item, from either cipher JSON shape. */
export function attachmentsOf(cipher: unknown): AttachmentFile[] {
  if (!cipher || typeof cipher !== 'object') return [];
  const record = cipher as Record<string, unknown>;
  const rows = record.attachments;
  if (Array.isArray(rows)) {
    return rows
      .map((row) =>
        row && typeof row === 'object'
          ? readFile((row as CliAttachment).id, row as CliAttachment)
          : null,
      )
      .filter((file): file is AttachmentFile => file !== null);
  }
  // Legacy shape: each attachment id is a top-level key whose value is the row.
  const files: AttachmentFile[] = [];
  for (const [id, row] of Object.entries(record)) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const shape = row as CliAttachment;
    const named =
      (typeof shape.fileName === 'string' && shape.fileName) ||
      (typeof shape.name === 'string' && Boolean(shape.name));
    if (named) files.push(readFile(id, shape)!);
  }
  return files;
}

export function addAttachmentArgs(path: string, itemId: string): string[] {
  return ['create', 'attachment', '--file', path, '--itemid', itemId];
}

export function downloadAttachmentArgs(id: string, itemId: string, path: string): string[] {
  return ['get', 'attachment', id, '--itemid', itemId, '--output', path];
}

export function deleteAttachmentArgs(id: string, itemId: string): string[] {
  return ['delete', 'attachment', id, '--itemid', itemId];
}
