# @oxvault/web

A local browser-based authenticator for TOTP (Time-based One-Time Password) codes.

## What it is

A local authenticator for TOTP secrets you paste in. Enter `otpauth://` URIs, `steam://` URIs, or raw base32 secrets to generate one-time codes and countdown timers in the browser.

## What it does NOT do

- **No vault sync**: Does not connect to or sync with your Bitwarden vault.
- **No server calls**: Makes zero network requests or API calls.
- **No write-back**: Never modifies, saves, or exports items back to any server or vault.
- **Nothing persisted**: Keeps secrets strictly in-memory. Switching away from the tab (window blur) or clicking Lock wipes all secrets and codes immediately. Nothing is stored in `localStorage`, `sessionStorage`, cookies, or IndexedDB.

## Running locally

Run the following commands from the workspace root:

```sh
# Start development server (serves on http://localhost:8000)
pnpm --filter @oxvault/web run dev

# Build production bundle (outputs to apps/web/dist)
pnpm --filter @oxvault/web run build

# Run TypeScript type check
pnpm --filter @oxvault/web run check

# Run tests
pnpm --filter @oxvault/web run test
```

## Deployment

The app is a static client bundle that can be hosted from a vault server's own origin under the `/oxvault/` path (for example, `https://vault.example.com/oxvault/`).

### Deployment Guard

To prevent execution in insecure contexts, `apps/web/src/lib/guard.ts` verifies the deployment origin at startup:

- Opaque origins (`null`, `file://`, `data://`) are rejected.
- Only HTTPS or localhost (`localhost`, `127.0.0.1`, `[::1]`) is permitted.

When deployment requirements fail, the guard produces the following exact failure message:

For opaque origins:

> OxVault web cannot run from an opaque origin (null). It requires HTTPS or localhost (e.g. https://vault.example.com or http://localhost:8000) under the /oxvault/ deploy path.

For insecure origins:

> OxVault web requires HTTPS (such as https://vault.example.com/oxvault/) or localhost (such as http://localhost:8000/oxvault/). Current origin '<origin>' is insecure. Deploy under https://<host>/oxvault/ or http://localhost:8000/oxvault/.

## License

MIT. OxVault web carries no GPL dependencies and is licensed under MIT like the rest of the repository.
