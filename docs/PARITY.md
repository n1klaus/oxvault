# Parity with the official Bitwarden clients

An honest status. "Full parity" is not reachable for a client that sits on top of the official CLI, because part of Bitwarden lives on the server and in the web vault. This page says which part is which.

Status words: **Done** works in OxVault. **Partial** works with limits. **Planned** is a client-side gap OxVault can close. **Not possible here** needs the server, the web vault, or key handling that OxVault's rules keep with the official CLI.

## Design Decisions

### Organization-Shared Items (Declined)

Upstream Bitlatch #21 added organization-shared items. OxVault declines this feature due to a write-back data-loss hazard in `cacheFields` / `hidesPasswords`. When restricted items are cached and then edited, sensitive fields could be cleared or corrupted. See https://github.com/dillionverma/bitlatch/issues/21 for discussion.

This means organization items appear as restricted and cannot be edited in OxVault.

### Master Password Items (Implemented)

Items marked with reprompt require unlocking with the master password before opening. OxVault implements this via Bitlatch #20 (`4f7e028ef`), which adds `openProtected(id, password)` to the API. Users can unlock such items directly without editing the cipher.

### One-Time Code Secrets (Implemented)

The desktop main process computes the verification code, and the popup receives the computed code. The stored authenticator key travels with the item detail to the desktop renderer and the browser popup, the same way a password does, so an editor can prefill it and save an existing key verbatim.

### Web Application (Local Authenticator)

The web app in this repo (`apps/web`) is a local authenticator only. It lets you paste in TOTP secrets to generate one-time codes in the browser with no vault sync, no server calls, and no persistent storage. A full mobile or browser vault needs the official SDK or a server, neither of which ships here.

`apps/web` is licensed under MIT like the rest of the repository because it carries no GPL dependency.

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
| One-time codes (TOTP)                                 | Done              | View, copy, create, edit and remove in the desktop app and browser popup; `oxvault totp` reads them                    |
| URI match rules                                       | Done              |                                                                                                                        |
| Folders: view, filter, assign, create, rename, delete | Done              | Nested names such as `A/B` show as flat names, not a tree                                                              |
| Custom fields: view, copy, edit                       | Done              | Linked fields are kept but not editable                                                                                |
| Password history: view and copy                       | Done              |                                                                                                                        |
| Attachments: add, download, delete                    | Done              | Desktop item view and `oxvault attach`. The server decides if the account may add files. Not run against a real server |
| Attachments: list                                     | Done              | Shown in the item detail, with save and delete per file                                                                |
| Items with master password re-prompt                  | Partial           | Shown with reprompt flag; `openProtected(id, password)` unlocks them. Editable only after opening.                     |
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
