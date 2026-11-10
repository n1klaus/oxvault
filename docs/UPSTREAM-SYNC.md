# OxVault Upstream Sync Strategy

## Overview

OxVault is a fork of **Bitlatch** (upstream at `dillionverma/bitlatch`), which itself forked from Bitwarden's official clients. This document describes how upstream commits are ported into OxVault.

The port history was linearized in this fork; pairs squashed/dropped per the plan.

## Sync Process

### Script: `scripts/sync-upstream-bitlatch.sh`

This script automates cherry-picking upstream Bitlatch commits while rebranding upstream `latch` directly to `oxvault`:

```bash
./scripts/sync-upstream-bitlatch.sh [--dry-run] [--from <sha>] [--only <sha,...>]
```

The script supports exactly three command-line flags:

- `--dry-run`: Lists all commits that would be applied without modifying working tree
- `--from <sha>`: Start from a specific commit SHA (exclusive), taking all commits up to `upstream-bitlatch/main`
- `--only <sha,...>`: Port only specified comma-separated SHAs

The script rebrands upstream `latch` directly to `oxvault`, and skips by default:

- The declined Tier C commit: `5323170983e54277bc16be33d99f1937733ab0fd` (`532317098`)
- The three Tier D agent-doc commits: `acde94847d149a97ec847f591810be8f47eea72e` (`acde94847`), `d15f89fd53437da57479d30295f3111f15fa74d5` (`d15f89fd5`), and `c6426f154585527038fd0a8479722f565dedaa2e` (`c6426f154`)
- The three Bitlatch release-prep chores: `522e67e5e6d939572a7c4d78bda3dd8ae2e004e3` (`522e67e5e`), `2968e2f3c3eb28ff8466bf737ba207576615c697` (`2968e2f3c`), and `896b7fdb28f36617edbe8a9f331f935aa9053b23` (`896b7fdb2`)

This accounts for seven skips out of 35 upstream commits.

### Trailer Format

Each ported commit carries the upstream commit trailer:

```
Upstream-Commit: <full-sha>
```

The script creates commits with this trailer format (alongside `Ported from dillionverma/bitlatch@<sha>`).

## Commit Tiers

Commits from upstream Bitlatch are classified into tiers:

- **Tier A: Security Fixes**: Verified security improvements, including IPC peer validation and credential leakage prevention.
- **Tier B: Features & Fixes**: Item types, folder management, passkey bugfixes, Raycast integrations, and vault matching features.
- **Tier C: Declined**: Organization-shared items (`532317098`, #21) was declined because upstream's implementation has a write-back hazard in `cacheFields` / `hidesPasswords` that can cause data loss. See `docs/PARITY.md` for details.
- **Tier D: Skip**: Documentation updates, agent docs, chore releases, and internal CI/CD changes.

## Port table

| Upstream SHA                               | Upstream Subject                                                            | Fork Commit(s)                                                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `566841dfed3615b3053a7ac777450e417e115112` | feat: manage vault items and website matching in popup                      | f026eb6673 feat: manage vault items and website matching in popup                                                 |
| `2aaf19be7d1a202ef9e652c682645a5729ccdce6` | fix: acknowledge browser saves before fetching large details                | bf0d5a1ea7 fix: acknowledge browser saves before fetching large details                                           |
| `3183a6419edc9dda0caea8bdb8a5c45dbd9451f2` | fix(autofill): distinguish login groups in shared forms                     | base-present (content already byte-identical in main:apps/extension/content/fields.ts; no fork commit applies it) |
| `b1e3343c2b26a85c6b3ae90c9c8edf5c3deaa9dd` | fix(security): verify macOS IPC peers and gate vault access                 | 2a926fbee7 fix(security): verify macOS IPC peers and gate vault access                                            |
| `679e4518252c267e31fd3a15b8799e36d75a5c54` | fix(raycast): declare the request timer as const (#6)                       | d8ae70883a fix(raycast): declare the request timer as const                                                       |
| `d0e55c62d832d4d843418e751536679a025b4db3` | fix(security): approve browser access once per browser until lock (#5)      | 98e308a3da fix(security): approve browser access once per browser until lock (#5)                                 |
| `a52cc2a7db2f4ffcf1e991a7bed86c6db2a9d8b4` | feat(desktop): view and edit card items (#4)                                | 8cca47613e feat(desktop): view and edit card items (#4)                                                           |
| `443f0d21b090de28a24a511d611798d47206a33a` | feat: show identity items and custom fields (#7)                            | 71509610a6 feat: show identity items and custom fields (#7)                                                       |
| `912b2aac355d4b4434c7e18de41ea4a4c397b9f0` | fix(security): keep CLI secrets out of process environments (#10)           | e613b4a133 fix(security): keep CLI secrets out of process environments (#10)                                      |
| `a5b86b0f8296ee393615a588a4c591e04ef729c4` | fix(security): lock after 15 minutes by default (#11)                       | 8f12cc9538 fix(security): lock after 15 minutes by default (#11)                                                  |
| `ab7ea815e46ff5b9c025a5914176e30754119371` | fix(passkeys): sign with the counter that was saved (#12)                   | 13502057da fix(passkeys): sign with the counter that was saved (#12)                                              |
| `a4e4dea2bf1a62e738b2fd3e1d2d64d9d337b86b` | fix(security): turn off browser and Raycast bridges off macOS (#13)         | 415db9472d fix(security): turn off browser and Raycast bridges off macOS (#13)                                    |
| `6c5520cf101a5d0247264305fc67375ec34ae663` | feat(desktop): submit a six-digit sign-in code as soon as it is typed (#15) | 12e34cf10d feat(desktop): submit a six-digit sign-in code as soon as it is typed (#15)                            |
| `342f64a551b60c706c4d1a6c0f386f54f359a929` | feat: show SSH keys, bank accounts, licenses, passports, and history (#16)  | 850af2f53f feat: show SSH keys, bank accounts, licenses, passports, and history (#16)                             |
| `98f4abf176b9916632efc71023e723e1cf2ff50c` | fix(privacy): fetch website icons from the vault's own server (#14)         | fd370ed419 fix(privacy): fetch website icons from the vault's own server (#14)                                    |
| `93f7623b20748523f6e8d302b6d3c03379a7adbd` | feat(desktop): show folders (#17)                                           | 237bf0b382 feat(desktop): show folders (#17)                                                                      |
| `9eb9b7e5e22d25a333f910430a25f46ab17dc25f` | feat(desktop): edit identities, custom fields, and folders (#18)            | 9c81435e1d feat(desktop): edit identities, custom fields, and folders (#18)                                       |
| `a3b9e342ad5393c05962b126c9b86960a8eb9448` | feat(desktop): create, rename, and delete folders (#19)                     | 67ef5fb9ca feat(desktop): create, rename, and delete folders (#19)                                                |
| `4f7e028ef93943d8bcb7c7feae00905c488c9881` | feat(desktop): open items that ask for the master password (#20)            | ee43148439 feat(desktop): open items that ask for the master password (#20)                                       |
| `aec3f9bac2949a1985c602e569134437e58b7c44` | feat(desktop): create SSH keys (#22)                                        | bf9a3527cc feat(desktop): create SSH keys (#22)                                                                   |
| `08fffeae526ba04734def787911a44db6494616a` | feat(raycast): show every item type and copy any field (#23)                | 8f1382c783 feat(raycast): show every item type and copy any field (#23)                                           |
| `8285406bbb8f3af426019e7cbee9ca8bc6462db6` | feat(extension): fill cards and identities into page forms (#24)            | a62fedb4cb feat(extension): fill cards and identities into page forms (#24)                                       |
| `a48786e9a84da1b37f173ae98061de3c187a9fa3` | fix(passkeys): register with Bitwarden's AAGUID (#26)                       | 779fab6655 fix(passkeys): register with Bitwarden's AAGUID                                                        |
| `9b6ef0bc92adf3b131eeaf497f7b619a7f346cf4` | fix(vault): allow moving passkey items to the trash (#27)                   | b6fca4cd4b fix(vault): allow moving passkey items to the trash (#27)                                              |
| `edb4ee1c539f59e681a46856c37c8211fcf86545` | fix(passkeys): never write a counter to a trashed item (#29)                | e550564691 fix(passkeys): never write a counter to a trashed item (#29)                                           |
| `4c2bce4e66df04cf96e593d3d012d33ce247925f` | fix(raycast): ask for Touch ID once per Raycast connection (#30)            | 5fb8df45b6 fix(raycast): ask for Touch ID once per Raycast connection (#30)                                       |
| `576cf4542f858d398215999a774062c9e12ef5f0` | fix(raycast): keep one approval per Raycast run until lock (#32)            | f0c0a10056 fix(raycast): keep one approval per Raycast run until lock (#32)                                       |
| `afa961e5660384d5a319c6ff189e36bf4d00290a` | fix(desktop): join a running unlock instead of flashing an error (#33)      | bf886bc268 fix(desktop): join a running unlock instead of flashing an error (#33)                                 |

## Current upstream state

Current upstream tracking numbers:

- **Upstream HEAD**: `896b7fdb28` (`upstream-bitlatch/main`)
- **Fork point**: `efbe4d0` (Bitlatch v0.3.5)
- **Total upstream commits in range**: 35 (`git rev-list --count efbe4d0..upstream-bitlatch/main`)
- **Ported commits with trailers**: 27
- **Skipped commits**: 7 (1 Tier C + 3 Tier D agent-docs + 3 release chores)
- **Base-present commits**: 1 (`3183a6419`)

## Brand Sweep Exceptions

When checking for upstream tokens with brand sweeps, the following files contain intentional exceptions:

- `docs/superpowers/plans/2026-11-03-desktop-attachments.md` (historical plan record)
- `site/package-lock.json` and `apps/raycast/store/package-lock.json` (regenerated names)
- `packages/shared/src/wordlist.ts` (English words from EFF passphrase list)
- `scripts/verify-secret-plumbing.sh` (`\bbitlatch\b` guard tokens)
- Lineage sentences in `README.md`, `site/content/home.md`, and `site/content/changelog.md` (crediting fork origin from `dillionverma/bitlatch`)

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
