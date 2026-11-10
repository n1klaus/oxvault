---
title: 'Privacy and network use: every endpoint OxVault calls'
description: 'The outbound network calls OxVault makes, what each one sends, and whether it is on by default. Four endpoints, found by grep, and how to check.'
nav: Privacy
order: 6
updated: 2026-10-10
---

# Privacy and network use

OxVault makes a small number of outbound calls itself. Everything else goes through `bw`, to the Bitwarden server you configured. There is no analytics code and no telemetry endpoint in `apps/` or `packages/`.

Check it yourself. Ignore `localhost`, `example.com` placeholders and schema or documentation URLs in the output:

```sh
grep -rnE "fetch\(|https?://" apps packages \
  --include=*.ts --include=*.tsx --include=*.mjs \
  --exclude-dir=node_modules --exclude-dir=.wxt --exclude-dir=dist
```

The table is what that grep finds in code that runs, as of 2026-10-10.

| Endpoint                                        | What is sent                                                                                | Default                                                                                                       | Where in source                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `https://api.pwnedpasswords.com/range/<prefix>` | The first 5 characters of the SHA-1 hash of a password. Request header `Add-Padding: true`. | Off. Settings switch, or `oxvault health --breaches`                                                          | `packages/shared/src/health.ts`          |
| `https://api.2fa.directory/v3/totp.json`        | Nothing from your vault. It downloads the whole public list. Matching happens locally.      | Off. `oxvault health --inactive-2fa`                                                                          | `packages/shared/src/health.ts`          |
| `<your vault server>/icons/<host>/icon.png`     | The hostname of a login's website, from the desktop app                                     | On. A Settings switch turns it off and clears the cache                                                       | `apps/desktop/src/main/website-icons.ts` |
| The Bitwarden server you set, through `bw`      | Whatever `bw` sends to sign in and sync. OxVault does not see or change it                  | On. This is the account itself. Default `https://vault.bitwarden.com`, with an EU option and a custom address | `apps/desktop/src/main/vault.ts`         |

## Breach lookup

OxVault hashes each password with SHA-1 on your machine and sends the first 5 hex characters to the Have I Been Pwned range API. The service returns every hash suffix that shares the prefix. OxVault compares the rest locally, so the password and the full hash stay put. This is the [k-anonymity range model](https://haveibeenpwned.com/API/v3#PwnedPasswords) that service documents.

## Website icons

The icon fetch is on by default. It sends the hostname of each login's website to the vault server the account is on at `/icons/<host>/icon.png`. Bitwarden's cloud icon services (`icons.bitwarden.net` and `icons.bitwarden.eu`) are used only for `vault.bitwarden.com` and `vault.bitwarden.eu` accounts. A self-hosted server with its own icon backend may leave icons missing if it uses an external redirect, because this client refuses redirects. The request has no cookies and no referrer, and responses over a size limit are dropped. Icons are cached in memory for 24 hours, and turning the setting off clears the cache. If you do not want your site list to leave the machine, turn it off in Settings. For the launcher bridge, the same icon URL is handed to the launcher app, which loads it.

## Updates

The desktop app contains an auto-update module. It only activates in a packaged macOS build that includes an `app-update.yml`. `apps/desktop/electron-builder.ts` sets `publish: null` and says "No update channel is configured", so no update endpoint is configured in the repo today.

## This website

The site is static HTML and one stylesheet. It ships no JavaScript, no analytics, no web fonts and no third-party requests. It is served by GitHub Pages, which keeps its own server logs.

## What OxVault stores

It does not store your vault. `bw` keeps its own data directory, as it does without OxVault. The app keeps small preference files in its user data folder, for example `website-icons.json` and the lock timeout. Check: `ls` the Electron user data directory for OxVault after one run.
