# Working on OxVault

- Keep the MVP small. `pnpm run check` runs static checks; `pnpm run build` builds all targets. Run both before shipping changes.
- Add a focused automated test when it pins a bug that already slipped through; keep fixtures synthetic and isolated, and do not write tests only to raise coverage. `pnpm run check` runs the matcher suite in `tests/matching.test.mjs` and the seven vitest files it also runs - four in `tests/`, added under `docs/superpowers/plans/2026-11-03-desktop-attachments.md` and `docs/superpowers/plans/2026-11-24-totp-review-fixes.md`, and three in `apps/web/src/lib/`, added with the local authenticator. Verify with type checking, builds, tests, and manual checks using synthetic data.
- Authentication and vault cryptography belong to the official Bitwarden CLI. Do not add a custom production crypto implementation.
- Packaged releases use a separately installed official CLI. Never bundle the npm CLI without resolving its mixed licensing.
- Never log passwords, vault contents, session keys, API keys, native pairing tokens, or raw CLI output. Test fixtures must remain synthetic and isolated.
- A locked vault must reject reads and fills immediately, including pending operations. Preserve this behavior during UI and lifecycle changes.
- Derive browser origins from Chrome's trusted sender metadata. Re-check matching when releasing the selected credential.
- Keep unknown item fields intact. Restrict edits and autofill to the supported personal-vault subset.
- The repository is public. Never commit secrets, session keys, or vault data.
