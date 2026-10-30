# oxvault

Unofficial command-line extras for Bitwarden. It is not made by or affiliated with Bitwarden.

It needs the official [Bitwarden CLI](https://bitwarden.com/help/cli/) (`bw`) on your PATH. `bw` handles sign-in and vault encryption. OxVault only reads items that `bw` has already decrypted. It never prints passwords or one-time secrets.

## Requirements

- Node 22.18 or newer
- The official `bw` CLI, signed in and unlocked (`BW_SESSION` set)

## Commands

- `oxvault totp <search>`: print the current one-time code for a matching login.
- `oxvault health [--breaches] [--inactive-2fa]`: report reused, weak and unencrypted-website logins.
- `oxvault attach <file> <item-id>`: attach a file to a login.
- `oxvault send <file> [--days N]`: create a file Send and print its link.

Run `oxvault` with no arguments to see all commands.

## Install

This package is not on npm yet. Download `oxvault-*.tgz` from the [releases page](https://github.com/n1klaus/oxvault/releases), then run `npm install -g ./oxvault-*.tgz`.

## License

MIT
