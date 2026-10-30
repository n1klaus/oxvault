# OxVault Upstream Sync Strategy

## Overview

OxVault is a fork of **Bitlatch** (upstream at `dillionverma/bitlatch`), which itself forked from Bitwarden's official clients. This document describes how upstream commits are ported into OxVault.

## Sync Process

### Script: `scripts/sync-upstream-bitlatch.sh`

This script automates cherry-picking upstream Bitlatch commits while rebranding them to OxVault:

```bash
./scripts/sync-upstream-bitroad.sh [--dry-run] [--from <sha>] [--only <sha,...>]
```

- `--dry-run`: Lists all commits that would be applied without modifying working tree
- `--from <sha>`: Start from a specific commit SHA (exclusive)
- `--only <sha,...>`: Port only specified comma-separated SHAs

### Branch Naming Convention

Each Tier B commit gets its own commit in OxVault with a trailer:

```
Subject line
Ported from dillionverma/bitlatch/<SHA>
Upstream-Commit: <SHA>
```

This makes it trivial to identify which OxVault commit corresponds to which upstream commit, and to revert or resync if needed.

## Commit Tiers

Commits from upstream Bitlatch are classified into tiers based on their content:

### Tier A: Security Fixes (Port First)

These are security-critical commits that must be applied immediately:

| Commit      | Description                                        |
| ----------- | -------------------------------------------------- |
| `912b2aac3` | Keep CLI secrets out of process environments       |
| `a5b86b0f8` | Lock after 15 minutes by default                   |
| `b1e3343`   | Verify macOS IPC peers and gate vault access       |
| `d0e55c62d` | Approve browser access once per browser until lock |
| `a4e4dea2b` | Turn off browser/Raycast bridges on macOS          |

These changes protect sensitive credentials from being exposed in environment variables visible to other processes running under the same user account.

### Tier B: Features (Port When Ready)

Feature commits are applied in sequence but not urgently. Examples include:

- Cards and identities item support
- SSH keys, bank accounts, licenses, passports, history
- Folders (create, rename, delete, edit)
- Passkey registration and counter fixes
- Raycast improvements
- Privacy fixes (self-hosted website icons)

The master password item fix (`4f7e028ef`) was particularly important—it enables editing items that require unlocking with the master password.

### Tier C: Declined

**Organization-shared items (#21)** was declined because upstream's implementation has a write-back hazard in `cacheFields` / `hidesPasswords` that can cause data loss. See `PARITY.md` for details.

### Tier D: Skip

Documentation updates, chore releases, and internal CI/CD changes are skipped entirely. These do not affect functionality.

## Verification

### Secret Plumbing Invariants

After any security port, verify with:

```bash
./scripts/verify-secret-plumbing.sh
```

This checks four invariant names across three files:

1. `payload.ts` declares the secret name
2. `cli.ts --passwordenv` argument matches
3. `cli.ts` secrets object key matches
4. `index.ts` fd variable naming matches

A failure means the master password falls back to real environment variables, leaking secrets.

### Brand Sweep

Run this grep to ensure no upstream brand tokens survived:

```bash
rg -In 'bitlatch|[Ss]trongroom|Latch|LATCH_|app\.strongroom' \
  -g '!pnpm-lock.yaml' -g '!site/package-lock.json' -g '!apps/raycast/store/package-lock.json' \
  -g '!upstream-commits.txt' -g '!docs/UPSTREAM-SYNC.md' -g '!docs/PARITY.md' \
  -g '!scripts/sync-upstream-bitlatch.sh'
```

Expected: zero results outside the excluded files, plus these intentional exceptions:

- `site/build.mjs` and `README.md` keep the MIT fork attribution line (`dillionverma/bitlatch`).
- `site/content/faq.md` and `site/content/home.md` state the fork origin for the same reason.
- `scripts/verify-secret-plumbing.sh` keeps its `\bbitlatch\b` guard tokens on purpose: they fail if the legacy names return to the CLI payload files.
- `packages/shared/src/wordlist.ts` matches are English words from the EFF passphrase list.
- `site/content/changelog.md` may mention the fork date and old name in rename-history entries.

## Current Upstream State

As of this document's creation:

- **Upstream tip**: `896b7fd` (main branch)
- **Fork point**: `efbe4d0` (Bitlatch v0.3.5)
- **Total commits to port**: 35
- **Applied to OxVault**: All Tier A (5) + Tier B (~20)
- **Skipped**: Tier C (1) + Tier D (6+)

See `upstream-commits.txt` in the repository root for the full commit list captured from upstream.

## Known Gaps

1. **serve.ts BW_SESSION leak**: The upstream fix for #10 covers cli.ts but may leave serve.ts still exposing `BW_SESSION`. Document this as a known remaining gap rather than silently leaving it unaddressed.

2. **No organization items**: See `PARITY.md` for the rationale behind declining #21.

3. **Web app needs a same-origin vault API**: Due to Vaultwarden CORS, the web app can only run from the vault server's origin, not GitHub Pages. See `apps/web/src/lib/guard.ts`.

## Maintaining the Fork

When upstream moves forward:

1. Re-fetch upstream: `git fetch upstream-bitlatch main`
2. Refresh snapshot: `gh api .../compare/efbe4d0...main > upstream-commits.txt`
3. Run dry-run: `./scripts/sync-upstream-bitlatch.sh --dry-run`
4. Review what changed, then apply with actual sync

The dry-run + trailer design makes re-sync cheap—just run the script again and it will pick up new commits without duplicates.
