# TOTP Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all five findings from the 2026-11-24 review of `fix/desktop-totp` without changing the TOTP trust model or the verbatim-key contract.

**Architecture:** Keep code computation in the Electron main process. The desktop row keeps one fetched code and ticks locally until rollover. The popup retries a transient fetch once before removing the row. `Vault.totp()` prefers an opened master-password item exactly as `detail()` does. The popup editor validates only a changed key, matching the desktop editor. No history rewrite.

**Tech Stack:** TypeScript, React 19, Electron IPC, WXT MV3 popup, shared TOTP module, vite-plus (`vp`), official `bw` CLI.

**Spec:** No standalone spec. The spec is the five findings from the 2026-11-24 code review of `735afe1142d3d3a52850e0bb0173d703ac65a13e..95e059a0dd66c5816c415c20279ab2a31c380ca5`, quoted under Source Findings.

## Source Findings

1. `apps/desktop/src/renderer/TotpRow.tsx:19-22` — `remaining` is always ≥ 1, so `Math.min(wait, 1000)` is always 1000. The row polls the main process every second; the comment misleads. Use the popup's local-tick shape.
2. Commit 1 says the seed "never reaches a renderer window or the browser bridge", but commit 2 adds `ItemDetail.totp` for editor prefill. That is the same channel as `password`; the narrative must say so.
3. `Vault.totp()` reads the cached cipher, whose `login.totp` is nulled for restricted items, even after the item is opened with the master password. An opened reprompt login shows the key in the editor but no code row.
4. `apps/extension/popup.ts:646-649` removes the TOTP row on any non-ok response, including a transient desktop hiccup. Retry once before removing.
5. Desktop validates a changed TOTP key client-side; the popup relies only on the main-process check. Add the same validation to the popup for parity.

## Global Constraints

- Authentication and vault cryptography stay with the official Bitwarden CLI. Do not add custom crypto.
- Never log passwords, vault contents, session keys, API keys, pairing tokens, or raw CLI output. Manual checks use synthetic data only.
- A locked vault must reject reads and fills immediately, including pending operations. Do not read `this.opened` without first passing `this.item(id)` / `requireUnlocked()`.
- Persist the authenticator key exactly as typed. Only a changed value that fails `parseTotp` is rejected; an unchanged legacy key round-trips untouched; clearing the field removes `login.totp`.
- Keep unknown item fields intact. Restrict edits to the supported personal-vault subset.
- Do not add automated tests. Project policy runs only the matcher suite and the six existing vitest files; verify with typecheck, the existing suites, build, and manual synthetic checks.
- Do not rewrite existing commits. Correct the seed-exposure narrative in `docs/PARITY.md`, not in history.
- The `pnpm` launcher in this checkout is broken (`@pnpm/exe` missing). Use the local runner equivalents below; they run the same scripts.

## File Structure

| File                                    | Responsibility                                  | Change                                    |
| --------------------------------------- | ----------------------------------------------- | ----------------------------------------- |
| `apps/desktop/src/main/vault.ts`        | Main-process vault reads, lock/restricted rules | Prefer opened reprompt cipher in `totp()` |
| `apps/desktop/src/renderer/TotpRow.tsx` | Desktop one-time-code row                       | Local countdown, fetch only at rollover   |
| `apps/extension/popup.ts`               | Popup detail row and editor                     | One retry; client-side key validation     |
| `docs/PARITY.md`                        | Honest client behavior record                   | State the seed exposure for editing       |

No files are created. Follow the existing module boundaries; do not move TOTP logic into shared UI code.

## Review Focus

Each line is pinned to the task that owns the code.

| Input / failure mode                                  | Expected behavior                                                                                              | Task |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---- |
| Lock the vault while an item is open                  | The code row disappears; `totp`/`copyTotp` reject immediately; the opened cache must not bypass the lock check | 1    |
| Open a reprompt login, then close it                  | A code appears while open; it disappears and copy fails after close/lock                                       | 1    |
| Code rollover at the period boundary                  | A new code appears within one second; no stale code is shown for a full extra period                           | 2    |
| Popup fetch fails once (desktop busy), then succeeds  | The row returns after the retry instead of disappearing permanently                                            | 3    |
| Edit a legacy unparseable key in the popup, unchanged | Saves verbatim; a changed invalid key is rejected before the request                                           | 4    |

A reasonable person using this software expects these behaviors even where the review does not spell them out.

---

### Task 1: Read the opened copy for a reprompt login's code

**Files:**

- Modify: `apps/desktop/src/main/vault.ts:670-676`
- Test: existing suites only; manual synthetic check

**Interfaces:**

- Consumes: `this.item(id)` (raises when locked or missing), `this.opened: Map<string, Cipher>`, `isRestricted(cipher)`, `totpFromField(secret)`
- Produces: `Vault.totp(id: string): Promise<TotpCode | null>` with unchanged signature

- [ ] **Step 1: Replace the cached-only read in `totp()`**

Use this body in `apps/desktop/src/main/vault.ts`:

```ts
async totp(id: string): Promise<TotpCode | null> {
  // `item()` rejects a locked vault before anything else is read.
  const cached = this.item(id);
  const opened = this.opened.get(id);
  const cipher = opened ?? cached;
  if (cipher.deletedDate) return null;
  if (!opened && isRestricted(cached)) return null;
  const secret = cipher.login?.totp;
  return secret ? totpFromField(secret) : null;
}
```

`opened` is set only after `verifyPassword` succeeds and only for a reprompt item; `lock()` clears it (`vault.ts:481`). The `!opened` guard preserves the restricted rejection for unopened items.

- [ ] **Step 2: Run the static gate**

Run: `./node_modules/.bin/vp check --no-fmt`
Expected: `pass: Found no warnings, lint errors, or type errors in ... files`

- [ ] **Step 3: Run the existing suites**

Run: `node --test tests/matching.test.mjs`
Expected: `tests 930`, `fail 0`

Run: `./node_modules/.bin/vp test run --exclude tests/matching.test.mjs`
Expected: `Test Files 6 passed (6)`, `Tests 60 passed (60)`

- [ ] **Step 4: Manual synthetic check**

Create a synthetic login with a reprompt flag and a synthetic base32 key. Open it with the master password. Expected: the verification-code row appears and `Copy verification code` succeeds. Close the item and lock the vault. Expected: the row disappears and copying reports no code. Confirm no real vault data or secrets enter the log.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main/vault.ts
git commit -m "fix(desktop): show a code for an opened master-password login"
```

---

### Task 2: Tick the desktop code locally instead of polling every second

**Files:**

- Modify: `apps/desktop/src/renderer/TotpRow.tsx:13-35`, `:58-60`
- Test: typecheck, existing suites, manual rollover check

**Interfaces:**

- Consumes: `window.oxvault.totp(itemId)` returning `Result<TotpCode | null>`; `TotpCode` has `code`, `remaining`, `period`
- Produces: `TotpRow({ itemId, disabled })` with unchanged props and markup

- [ ] **Step 1: Replace the effect and add a countdown state**

Use this shape in `apps/desktop/src/renderer/TotpRow.tsx`:

```tsx
const [totp, setTotp] = useState<TotpCode | null>(null);
const [remaining, setRemaining] = useState(0);
// ...
useEffect(() => {
  alive.current = true;
  setTotp(null);
  setRemaining(0);
  setCopied(false);
  let ticker: ReturnType<typeof setInterval> | undefined;
  let expiresAt = 0;

  async function refresh() {
    if (ticker) {
      clearInterval(ticker);
      ticker = undefined;
    }
    try {
      const result = await window.oxvault.totp(itemId);
      if (!alive.current) return;
      if (!result.ok || !result.value) {
        setTotp(null);
        return;
      }
      const value = result.value;
      setTotp(value);
      expiresAt = Date.now() + value.remaining * 1000;
      setRemaining(value.remaining);
      if (ticker) clearInterval(ticker);
      ticker = setInterval(() => {
        if (!alive.current) return;
        const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
        setRemaining(left);
        if (left === 0) {
          if (ticker) clearInterval(ticker);
          ticker = undefined;
          void refresh();
        }
      }, 1000);
    } catch {
      if (alive.current) setTotp(null);
    }
  }

  void refresh();
  return () => {
    alive.current = false;
    if (ticker) clearInterval(ticker);
  };
}, [itemId]);
```

Delete the old `timer`/`setTimeout` refresh loop. Leave the copy handler and markup unchanged except the label:

```tsx
Verification code · {remaining}s
```

- [ ] **Step 2: Run the static gate**

Run: `./node_modules/.bin/vp check --no-fmt`
Expected: no warnings, lint errors, or type errors.

- [ ] **Step 3: Manual rollover check**

Use a synthetic login with a 30-second code. Expected: the label counts down once per second without re-fetching, the six-digit code changes within one second of `0s`, and the new code then counts down normally. Confirm the code does not remain stale for an extra period.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/renderer/TotpRow.tsx
git commit -m "fix(desktop): tick the one-time-code countdown locally"
```

---

### Task 3: Retry a transient popup fetch once

**Files:**

- Modify: `apps/extension/popup.ts:637-658`
- Test: existing suites; manual transient-failure check

**Interfaces:**

- Consumes: `send<{ code: string; remaining: number } | null>`, `current(version, lifetime)`, `after`, `row`
- Produces: `addTotp(item: ItemDetail, after: Element): void` with unchanged signature

- [ ] **Step 1: Add one retry to `load()`**

Change `load` to accept an attempt count and schedule one retry:

```ts
async function load(attempt = 0) {
  if (timer) clearInterval(timer);
  const response = await send<{ code: string; remaining: number } | null>({
    type: 'totp',
    id: item.id,
  });
  if (!current(version, lifetime) || (!row.isConnected && code)) return;
  if (!response.ok || !response.value) {
    if (attempt === 0) {
      setTimeout(() => void load(1), 1000);
    } else {
      row.remove();
    }
    return;
  }
  // unchanged success path: code, expiresAt, value text, row insertion, paint, interval
}
```

Keep the success path and the existing interval cleanup exactly as they are. The second failure still removes the row, so a locked vault does not leave a stale row.

- [ ] **Step 2: Run the static gate**

Run: `./node_modules/.bin/vp check --no-fmt`
Expected: no warnings, lint errors, or type errors.

- [ ] **Step 3: Manual transient-failure check**

Open a synthetic login's detail in the popup. Make the desktop app briefly unavailable for one fetch, then available. Expected: the row returns after the retry. Make it unavailable for two fetches. Expected: the row disappears. Lock the vault. Expected: the row disappears without restoring old data.

- [ ] **Step 4: Commit**

```bash
git add apps/extension/popup.ts
git commit -m "fix(popup): retry a transient one-time-code fetch"
```

---

### Task 4: Validate a changed popup TOTP key before saving

**Files:**

- Modify: `apps/extension/popup.ts:2` (import), `:895-906` (submit handler)
- Test: typecheck; manual synthetic check

**Interfaces:**

- Consumes: `parseTotp` from `@oxvault/shared/totp`, `editing.item?.totp`, `draft.totp`, `feedback(message)`
- Produces: unchanged editor markup and `save` request shape

- [ ] **Step 1: Import the shared parser**

Add to the imports in `apps/extension/popup.ts`:

```ts
import { parseTotp } from '@oxvault/shared/totp';
```

- [ ] **Step 2: Reject only a changed invalid key**

Inside the existing `form.addEventListener('submit', ...)` handler, before `void operation(...)`:

```ts
const totp = draft.type === 1 ? draft.totp : undefined;
if (totp && totp !== (editing.item?.totp ?? '') && !parseTotp(totp)) {
  feedback('Enter an authenticator key as a secret or an otpauth:// link.');
  return;
}
```

This mirrors `Editor.tsx:242-246`: an untouched legacy key is not validated and round-trips verbatim.

- [ ] **Step 3: Run the static gate**

Run: `./node_modules/.bin/vp check --no-fmt`
Expected: no warnings, lint errors, or type errors.

- [ ] **Step 4: Manual synthetic check**

In the popup editor, leave a synthetic legacy unparseable key unchanged. Expected: save succeeds and the stored value is unchanged. Change it to an invalid value. Expected: the message appears, no request is sent. Change it to a valid base32/`otpauth://` value. Expected: save succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/popup.ts
git commit -m "fix(popup): validate a changed authenticator key before saving"
```

---

### Task 5: State the seed exposure honestly in the docs

**Files:**

- Modify: `docs/PARITY.md:19` (insert before `### Web Application (Local Authenticator)`)
- Test: formatting and static gate

**Interfaces:** none; documentation only.

- [ ] **Step 1: Add the design-decision paragraph**

Insert before `### Web Application (Local Authenticator)`:

```markdown
### One-Time Code Secrets (Implemented)

The desktop main process computes the verification code, and the popup receives the computed code. The stored authenticator key travels to the desktop renderer and the browser popup when an editor opens, the same way a password does, so an existing key can be edited verbatim.
```

This corrects finding 2 without rewriting the earlier commit message.

- [ ] **Step 2: Check formatting and docs consistency**

Run: `./node_modules/.bin/vp fmt --check docs/PARITY.md`
Expected: `All matched files use the correct format.`

Run: `./node_modules/.bin/vp check --no-fmt`
Expected: no warnings, lint errors, or type errors.

- [ ] **Step 3: Commit**

```bash
git add docs/PARITY.md
git commit -m "docs(parity): state where the authenticator key is exposed"
```

---

## Final Gate

After Task 5, run the same gates the review used:

```bash
node --test tests/matching.test.mjs
./node_modules/.bin/vp test run --exclude tests/matching.test.mjs
./node_modules/.bin/vp check --no-fmt
./node_modules/.bin/vp fmt --check apps/desktop/src/main/vault.ts apps/desktop/src/renderer/TotpRow.tsx apps/extension/popup.ts docs/PARITY.md
./node_modules/.bin/vp run --filter @oxvault/desktop --filter oxvault-raycast --filter oxvault --fail-if-no-match build
./node_modules/.bin/vp run @oxvault/extension#build:extras
node apps/desktop/build/build-safari.mjs
```

Expected: matcher `930`/`0`; vitest `60` passed; `vp check` clean; format clean; every build exits `0`.

Do not stage or commit build output. Do not include `ARCHITECTURE.md`; it is untracked and outside this plan.
