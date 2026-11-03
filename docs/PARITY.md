# Parity with the official Bitwarden clients

An honest status. "Full parity" is not reachable for a client that sits on top of the official CLI, because part of Bitwarden lives on the server and in the web vault. This page says which part is which.

Status words: **Done** works in OxVault. **Partial** works with limits. **Planned** is a client-side gap OxVault can close. **Not possible here** needs the server, the web vault, or key handling that OxVault's rules keep with the official CLI.

## Design Decisions

### Organization-Shared Items (Declined)

Upstream Bitlatch #21 added organization-shared items. OxVault declines this feature due to a write-back data-loss hazard in `cacheFields` / `hidesPasswords`. When restricted items are cached and then edited, sensitive fields could be cleared or corrupted. See https://github.com/dillionverma/bitlatch/issues/21 for discussion.

This means organization items appear as restricted and cannot be edited in OxVault.

### Master Password Items (Implemented)

Items marked with reprompt require unlocking with the master password before opening. OxVault implements this via Bitlatch #20 (`4f7e028ef`), which adds `openProtected(id, password)` to the API. Users can unlock such items directly without editing the cipher.

### Web Vault (Requires a Vault Server at the Same Origin)

OxVault includes `apps/web`, a TOTP authenticator for browser-based access. Status: **Partial**. It is a static bundle with no server of its own — a vault server must serve the bundle and an `/api/v1/*` API at the same origin, and no such server ships with OxVault.

Vaultwarden's CORS policy blocks external origins — GitHub Pages would fail. The deployment guard (`apps/web/src/lib/guard.ts`) rejects opaque origins, requires HTTPS (except localhost in development), and when `VITE_TRUSTED_ORIGINS` is set, rejects any origin not on that allowlist. `VITE_API_BASE` points the calls at a vault API on a trusted origin, if it is not same-origin.

Scope is intentionally limited: unlock, list TOTP-bearing logins, show code and countdown, copy. No write-back operations, which sidesteps the #21 hazard entirely.

## Vault items

| Item or feature                                       | Status            | Notes                                                                                                                  |
| ----------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Logins: view, create, edit, trash, restore            | Done              |                                                                                                                        |
| Secure notes: view, create, edit                      | Done              |                                                                                                                        |
| Favorites                                             | Done              |                                                                                                                        |
| Cards: view, copy, create, edit                       | Done              |                                                                                                                        |
| Identities: view, copy, create, edit                  | Done              |                                                                                                                        |
| SSH keys: view, copy, edit                            | Done              | New keys can be pasted in, not generated                                                                               |
| Passkeys                                              | Partial           | Used through macOS AutoFill. Editing a passkey item is left to Bitwarden                                               |
| One-time codes (TOTP)                                 | Done              | Desktop, browser popup and command line                                                                                |
| URI match rules                                       | Done              |                                                                                                                        |
| Folders: view, filter, assign, create, rename, delete | Done              | Nested names such as `A/B` show as flat names, not a tree                                                              |
| Custom fields: view, copy, edit                       | Done              | Linked fields are kept but not editable                                                                                |
| Password history: view and copy                       | Done              |                                                                                                                        |
| Attachments: add, download, delete                    | Done              | Desktop item view and `oxvault attach`. The server decides if the account may add files. Not run against a real server |
| Attachments: list                                     | Done              | Shown in the item detail, with save and delete per file                                                                |
| Items with master password re-prompt                  | Partial           | Shown with reprompt flag; `openProtected(id, password)` unlocks them. Editing left to official client.                 |
| Organization and collection items                     | Not possible here | Shown as restricted. Needs organization key handling                                                                   |

## Sending and sharing

| Feature                                             | Status            | Notes                                                                          |
| --------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------ |
| File Send: create                                   | Done              | Desktop app and `oxvault send`. The server decides if the account may          |
| Text Send, list, copy link, remove password, delete | Done              | Editing an existing Send is not built                                          |
| Sharing items with an organization                  | Not possible here | Organization keys                                                              |
| Emergency access                                    | Not possible here | Server API and a key exchange between accounts. See [FEATURES.md](FEATURES.md) |

## Filling and generating

| Feature                                      | Status | Notes                                   |
| -------------------------------------------- | ------ | --------------------------------------- |
| Browser fill (Chromium, Firefox, Safari)     | Done   |                                         |
| macOS AutoFill                               | Done   |                                         |
| Password, passphrase and username generators | Done   | Passphrases use the EFF large word list |
| Save new logins from the browser             | Done   |                                         |

## Account and security

| Feature                                                                     | Status            | Notes                                                                                                              |
| --------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| Unlock with master password                                                 | Done              |                                                                                                                    |
| Unlock with Touch ID                                                        | Done              | macOS only                                                                                                         |
| Two-step sign-in prompts (authenticator, YubiKey, email)                    | Done              |                                                                                                                    |
| Auto-lock timer                                                             | Done              |                                                                                                                    |
| Vault health reports                                                        | Done              | See [FEATURES.md](FEATURES.md)                                                                                     |
| Single sign-on, device approval, passkey sign-in                            | Not possible here | The CLI signs in with a password or API key                                                                        |
| Change master password, KDF settings, set up two-step login, delete account | Not possible here | Web vault                                                                                                          |
| Import (29 formats) and export (CSV, JSON, account-key encrypted JSON)      | Done              | Password-protected exports and imports are not supported, because `bw` would need the password on its command line |
| Self-hosted server                                                          | Partial           | Server address can be set. Not tested against a real self-hosted server                                            |

## Out of scope

Admin Console, Provider Portal, Secrets Manager, billing and plans, and organization policies are web and server products. A client cannot provide them.
