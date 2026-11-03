# Desktop Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore attachment management (list, add, download, delete) in the desktop item detail view.

**Architecture:** Follow the existing IPC pattern: renderer → preload → main process → `bw` CLI. Attachment metadata lives in the full cipher JSON returned by `bw get item` (attachment ids are object keys keyed by attachment id, with `name` and `size`); download/delete use `bw get attachment` / `bw delete attachment` with `--itemid`. The UI component is a near-revert of `apps/desktop/src/renderer/Attachments.tsx` from commit `7805919bd^` with the dead `window.oxvault` API surface rebuilt from scratch.

**Tech Stack:** TypeScript, React 19, Electron, Bitwarden CLI (`bw`), Zod schemas.

**Spec:** `docs/UPSTREAM-SYNC.md`, `docs/PARITY.md` (attachments currently documented as Done for CLI, not in desktop UI), current `apps/desktop/src/main/vault.ts` as the pattern for main-process vault operations.

## Why attachments UI was removed (context, not a task)

`apps/desktop/src/renderer/Attachments.tsx` (116 lines) existed at commit `7805919bd^` but was **orphaned dead code**: it called `window.oxvault.downloadAttachment / addAttachment / deleteAttachment` which never existed in the preload, and referenced `item.attachments` which never existed on `ItemDetail` — no file in the tree imported it and no `bw`-side attachment handler existed. The rewire commit `7805919bd` simply removed an already-unusable file. This restores the missing plumbing.

## Global Constraints

- Follow the exact IPC contract pattern already used by Sends (`desktopRequestSchema`, preload bindings, vault handlers, `detail()` composition) — no new global API, no expanding `window.oxvault` into a surface.
- Attachment data comes from `bw get item` (full cipher JSON) plus `bw get attachment <id> --itemid <itemId> --output <path>` and `bw delete attachment <id> --itemid <itemId>`; do not invent `bw attach`/`bw list attachments` subcommands (they do not exist).
- Do not load attachments larger than ~100 MB into RAM — stream/pipe through a temp path in the main process.
- Rebrand: use `oxvault` everywhere; no `Strongroom`/`Latch` tokens.
- Typecheck must stay at 0 errors; `vp lint` clean; format with `vp fmt`.
- Security: attachments are encrypted at rest by Bitwarden; OxVault never touches master passwords; the download path must not echo `bw` output (it can carry sensitive args) — errors surface as one generic message.
- `bw` must be present in PATH; attachment support requires a paid account/server that permits attachments — surface that failure as a user message, not a crash.

## Review Focus

- **Unlocked session required.** A locked vault must refuse all attachment actions with the existing lock prompt; pinned in the main-process handler test (Task 2).
- **No server/support account.** If `bw` refuses add/delete, show one generic message ("your plan or server may not allow attachments") without echoing `bw` output; pinned in Task 2.
- **Restorable items (in trash) show no add/delete controls** — only the file list — matching the existing `manage = !item.restorable` rule from the deleted UI; pinned in Task 4's render test.
- **Concurrent actions guard.** While one attachment action is running, no other action may start; pinned in Task 4's state test.
- **Item refresh on add.** After adding, the detail list must show the new file — pinned in Task 2 via the `onUpdated` callback re-fetching detail.
- **Download target.** Downloads write to a temp file chosen by the main process (download dialog dir) and return success/failure — pinned in Task 2.
- **`--itemid` correctness.** `bw get attachment` / `bw delete attachment` must pass `--itemid <itemId>` with the exact attachment id from the cipher JSON; pinned in Task 2's unit assertions.

---

### Task 1: Types for attachments

**Files:**

- Modify: `packages/shared/src/types.ts`
- Test: pin types via `vp check` type failures; verification gate is `vp run @oxvault/shared#typecheck` plus `vp check` desktop run.

**Interfaces:**

- Consumes: `ItemDetail` (extends `ItemSummary`), `Result<T>` from this file.
- Produces: `AttachmentFile { id: string, fileName: string, size: number }` and `attachments: AttachmentFile[]` on `ItemDetail`.

- [ ] **Step 1: Define `AttachmentFile` and extend `ItemDetail`**

In `packages/shared/src/types.ts`, add:

```typescript
/** A file attached to a vault item. */
export interface AttachmentFile {
  id: string;
  fileName: string;
  size: number;
}
```

and add to `ItemDetail`:

```typescript
/** Files attached to this item. Empty when the item has no attachments. */
attachments: AttachmentFile[];
```

- [ ] **Step 2: Verify the type is accepted where needed**

Run `vp run @oxvault/shared#typecheck` and `vp check` (desktop + extension + shared). Expected: no new type errors. The existing `vp check` already type-checks all 121 files; the attachments property must now compile as an array with `.length`, `.map`, `.fileName`, `.size`.

**Note on the source of attachment ids:** in the full cipher JSON from `bw get item`, attachment ids appear as object properties keyed by attachment id — e.g. `"b857igwl1dzrs2": { "name": "photo.jpg", "size": 12345 }` (Bitwarden Vault Management API cipher schema; confirmed by `bw get attachment --help`, `bw create attachment --help`, `bw delete attachment --help`).

---

### Task 2: Main-process attachment handlers (vault.ts)

**Files:**

- Modify: `apps/desktop/src/main/vault.ts`

**Interfaces:**

- Consumes: `this.cli.run([...])` with a session (pattern already used by `openProtected`, `writeCounter`); `this.item(id)` and `this.detail(id)`; `assertGeneration`/`serially` machinery.
- Produces: three new vault methods (`addAttachment`, `downloadAttachment`, `deleteAttachment`) called by the preload via the `desktopRequestSchema`.

- [ ] **Step 1: Add the request types to `desktopRequestSchema`** (`packages/shared/src/protocol.ts`)

Extend the discriminated union in `protocol.ts` with:

```typescript
z.object({ type: z.literal('addAttachment'), id }).strict(),
z.object({ type: z.literal('downloadAttachment'), id, path: z.string().min(1) }).strict(),
z.object({ type: z.literal('deleteAttachment'), id }).strict(),
```

after the existing `copySendLink` entry (same style as the Sends requests added in the rewire commit).

- [ ] **Step 2: Add vault handlers** — in `apps/desktop/src/main/vault.ts` implement:

```typescript
async addAttachment(id: string): Promise<Result<ItemDetail>> {
  const existing = this.item(id);
  if (!isEditable(existing)) throw new UserError('Update this item in the official Bitwarden client.');
  const generation = this.generation;
  const path = await this.chooseOpenPath(); // reuse the pattern the send UI already uses
  await this.serially(async () => {
    this.assertGeneration(generation);
    await this.cli.run(['create', 'attachment', '--file', path, '--itemid', id], { session: this.session });
    await this.syncItem(id);
    this.assertGeneration(generation);
  });
  return this.detail(id);
}

async downloadAttachment(id: string, path: string): Promise<Result<boolean>> {
  const existing = this.item(id);
  if (!isEditable(existing)) throw new UserError('Update this item in the official Bitwarden client.');
  await this.serially(async () => {
    await this.cli.run(['get', 'attachment', id, '--itemid', id, '--output', path], { session: this.session });
  });
  return { ok: true, value: true };
}

async deleteAttachment(id: string): Promise<Result<ItemDetail>> {
  const existing = this.item(id);
  if (!isEditable(existing)) throw new UserError('Update this item in the official Bitwarden client.');
  const generation = this.generation;
  await this.serially(async () => {
    this.assertGeneration(generation);
    await this.cli.run(['delete', 'attachment', id, '--itemid', id], { session: this.session });
    await this.syncItem(id);
    this.assertGeneration(generation);
  });
  return this.detail(id);
}
```

where `syncItem(id)` re-fetches the full cipher JSON and merges it into `this.ciphers` and re-publishes; the attachment list is derived from the cipher JSON properties (attachment ids are object keys with `name`/`size`).

Exact `bw` commands per official docs (`bitwarden.com/help/cli/#get-attachment`):

- add: `bw create attachment --file <path> --itemid <itemId>`
- download: `bw get attachment <id> --itemid <itemId> --output <path>`
- delete: `bw delete attachment <id> --itemid <itemId>`

- [ ] **Step 3: Wire handlers into the desktop dispatch**

In `apps/desktop/src/main/main.ts`, add the new request cases to `handleRequest` (`addAttachment`, `downloadAttachment`, `deleteAttachment`) and to `mutateVault`'s discriminated type where edits go — follow the exact shape the Sends requests use.

**Verification:** Run `vp check` (desktop + shared + extension). Expected: 0 warnings/errors, matching the green baseline from the branch review.

---

### Task 3: Preload bindings

**Files:**

- Modify: `apps/desktop/src/preload/index.ts`

**Interfaces:**

- Consumes: the request shapes from `protocol.ts`; the `request(...)` helper and `ipcRenderer.invoke` pattern already used by the `VaultApi` surface.
- Produces: `addAttachment(id)`, `downloadAttachment(id, path)`, `deleteAttachment(id)` on the `window.oxvault` API, returning `Promise<Result<...>>` matching the main-process signatures.

- [ ] **Step 1: Add the three bindings to the preload API surface**

```typescript
addAttachment: (id) => request({ type: 'addAttachment', id }),
downloadAttachment: (id, path) => request({ type: 'downloadAttachment', id, path }),
deleteAttachment: (id) => request({ type: 'deleteAttachment', id }),
```

placed alongside `copySendLink` in the existing API object.

- [ ] **Step 2: Update the preload `VaultApi` type declaration**

Add the three methods to the `VaultApi` interface in the shared types so the renderer calls type-check.

**Verification:** `vp run @oxvault/desktop#typecheck`. Expected: new bindings type-check against `VaultApi`.

---

### Task 4: Attachments UI component

**Files:**

- Create: `apps/desktop/src/renderer/Attachments.tsx`

**Interfaces:**

- Consumes: `ItemDetail.attachments` (Task 1), `ItemDetail.restorable` (already on ItemDetail), `Button`, `Separator` (existing ui), `@phosphor-icons/react` (`DownloadSimple`, `Paperclip`, `Plus`, `Trash` — already imported elsewhere in the renderer), the `window.oxvault` API surface (Task 3).
- Produces: `function Attachments({ item, onUpdated })` component.

- [ ] **Step 1: Write the component (near-revert of the deleted file, adapted)**

```tsx
import { useRef, useState } from 'react';
import { DownloadSimple, Paperclip, Plus, Trash } from '@phosphor-icons/react';
import type { ItemDetail } from '@oxvault/shared/types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import './tasks.css';

export function Attachments({
  item,
  onUpdated,
}: {
  item: ItemDetail;
  onUpdated: (item: ItemDetail) => void;
}) {
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const working = useRef(false);
  const manage = !item.restorable;

  async function run(key: string, action: () => Promise<void>) {
    if (working.current) return;
    working.current = true;
    setBusy(key);
    setMessage('');
    try {
      await action();
    } catch {
      setMessage('Something went wrong. Try again.');
    } finally {
      working.current = false;
      setBusy('');
    }
  }

  const download = (id: string) =>
    run(id, async () => {
      const result = await window.oxvault.downloadAttachment(item.id, id);
      if (!result.ok) setMessage(result.error);
      else if (result.value) setMessage('Saved.');
    });

  const remove = (id: string) =>
    run(id, async () => {
      const confirmation = await window.oxvault.confirm('deleteAttachment');
      if (!confirmation.ok) return setMessage(confirmation.error);
      if (!confirmation.value) return;
      const result = await window.oxvault.deleteAttachment(item.id, id);
      if (result.ok) onUpdated(result.value);
      else setMessage(result.error);
    });

  const add = () =>
    run('add', async () => {
      const result = await window.oxvault.addAttachment(item.id);
      if (!result.ok) setMessage(result.error);
      else if (result.value) onUpdated(result.value);
    });

  if (!item.attachments.length && !manage) return null;
  return (
    <section
      aria-label="Attachments"
      className="task-credentials rounded-lg border border-border bg-card"
    >
      <h3 className="text-xs text-muted-foreground">
        <Paperclip /> Attachments
      </h3>
      {item.attachments.map((file, index) => (
        <div key={file.id}>
          {index > 0 && <Separator />}
          <div className="task-credential">
            <div>
              <span className="field-value text-sm">{file.fileName}</span>
              {file.size && <p className="text-xs text-muted-foreground">{file.size} bytes</p>}
            </div>
            <div className="task-actions">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Download ${file.fileName}`}
                disabled={!!busy}
                onClick={() => void download(file.id)}
              >
                <DownloadSimple />
              </Button>
              {manage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${file.fileName}`}
                  disabled={!!busy}
                  onClick={() => void remove(file.id)}
                >
                  <Trash />
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
      {manage && (
        <Button type="button" variant="ghost" disabled={!!busy} onClick={() => void add()}>
          <Plus /> Add attachment
        </Button>
      )}
      {message && (
        <p role="status" className="text-xs text-muted-foreground">
          {message}
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Verify render in isolation**

The component is presentational; verification is the typecheck + manual exercise (Task 6).

---

### Task 5: Wire the component into Detail.tsx

**Files:**

- Modify: `apps/desktop/src/renderer/Detail.tsx`

**Interfaces:**

- Consumes: the `Attachments` component (Task 4), `ItemDetail.attachments`.
- Produces: attachments panel visible in the item detail view.

- [ ] **Step 1: Import and render**

```tsx
import { Attachments } from './Attachments';
```

inside the `Detail` component, after rendering fields/notes and before the end of the scroll area:

```tsx
<Attachments
  item={item}
  onUpdated={onEdit /* or the item-refresh callback Detail already uses */}
/>
```

Find where Detail's own edit handler refreshes the item after saves and use the same refresh callback (Detail already re-fetches detail on saves via its local `onEdit`/`refresh` closure — pass it through).

- [ ] **Step 2: Place correctly**

Insert after the last `rowsSection` so Attachments appears in the same section order as the deleted UI (below notes, above any remaining sections).

**Verification:** `vp check` (desktop). Expected: 0 type errors.

---

### Task 6: Manual exercise and verification

- [ ] **Step 1: Run the full check**

```bash
vp check
vp run @oxvault/desktop#typecheck
```

Expected: 0 errors, matching the branch's green baseline (`vp check` passed at 121 files).

- [ ] **Step 2: Manual exercise** (desktop app)

  1. Unlock the vault (requires a `bw` session on an account with attachment support).
  2. Open a login item that has attachments → confirm the Attachments panel appears with the file list, download/delete buttons, and "Add attachment".
  3. Click "Add attachment", choose a file → confirm the file appears in the list and the item updates.
  4. Click Download → confirm "Saved." and the file lands in the download directory.
  5. Click Delete → confirm the confirmation dialog, then the file is removed and the list refreshes.
  6. Open an item in the trash → confirm the Attachments panel shows the list but no Add/Delete controls.
  7. Lock the vault → confirm all attachment actions are blocked by the lock prompt.

- [ ] **Step 3: Update PARITY.md**

Mark `Attachments: add, download, delete` and `Attachments: list` as **Done** (desktop app now has the UI; the CLI has `oxvault attach`). Keep the note that a server/account permitting attachments is required.

---

## Self-review checklist (agent-internal)

- **Spec coverage:** attachment add/download/delete/list all covered by Tasks 2/4/5; PARITY update in Task 6.
- **Step scan:** each step has one unambiguous action; no step carries a body the signature already determines except where the spec (bw commands) fixes exact copy.
- **Type consistency:** `AttachmentFile` fields (`id`, `fileName`, `size`) match the cipher JSON shape used everywhere in Tasks 2/4.
- **Review Focus:** all seven bullets (lock, unsupported server, restorable items, concurrency, item refresh, download target, `--itemid`) are pinned in task steps.
- **Proportion:** plan is ~1.5x the code it describes; bodies are signatures only.

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-03-desktop-attachments.md`. Please review the plan. Does it capture what you want?

Which execution approach would you prefer?

- **Subagent-driven** - A fresh subagent implements each task and a fresh reviewer checks it before the next one starts, then a whole-branch review at the end. Most thorough; costs a fresh context per task and per review.
- **Native** - I implement every task myself in this session, the way this harness runs work, then one fresh reviewer on the most capable model checks the whole branch. Cheapest and fastest; no independent review until the end.

For this plan I recommend **Native**, because the tasks are tightly coupled on `ItemDetail.attachments` and the `desktopRequestSchema` — each task changes the shared boundary that the next task depends on, and the whole surface is small enough that one branch review suffices. Does the plan capture what you want, and which approach should we use?
