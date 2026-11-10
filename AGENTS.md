# Working on OxVault

- Keep the MVP small. `pnpm run check` runs static checks; `pnpm run build` builds all targets. Run both before shipping changes.
- Do not add automated tests beyond what `pnpm run check` already runs: the three vitest suites in `tests/` and the matcher suite in `tests/matching.test.mjs`, both added under `docs/superpowers/plans/2026-11-03-desktop-attachments.md`. Verify with type checking, builds, tests, and manual checks using synthetic data.
- Authentication and vault cryptography belong to the official Bitwarden CLI. Do not add a custom production crypto implementation.
- Packaged releases use a separately installed official CLI. Never bundle the npm CLI without resolving its mixed licensing.
- Never log passwords, vault contents, session keys, API keys, native pairing tokens, or raw CLI output. Test fixtures must remain synthetic and isolated.
- A locked vault must reject reads and fills immediately, including pending operations. Preserve this behavior during UI and lifecycle changes.
- Derive browser origins from Chrome's trusted sender metadata. Re-check matching when releasing the selected credential.
- Keep unknown item fields intact. Restrict edits and autofill to the supported personal-vault subset.
- The repository is public. Never commit secrets, session keys, or vault data.
