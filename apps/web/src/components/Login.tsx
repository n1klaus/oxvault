import { useState, type FormEvent } from 'react';
import { unlock } from '../lib/auth';
import type { LoginInput } from '@oxvault/shared/types';

/** Default self-hosted Bitwarden-compatible server; override with VITE_DEFAULT_SERVER. */
const DEFAULT_SERVER =
  (import.meta.env['VITE_DEFAULT_SERVER'] as string | undefined) ?? 'https://vault.bitwarden.com';

export function Login({ onUnlock }: { onUnlock: (session: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const input: LoginInput = {
        email: email.trim().toLowerCase(),
        password,
        server: DEFAULT_SERVER,
      };

      const session = await unlock(input);
      onUnlock(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{ maxWidth: 400, margin: '0 auto', background: 'white', padding: 32, borderRadius: 8 }}
    >
      <h1 style={{ marginBottom: 24, textAlign: 'center' }}>OxVault Web</h1>

      {error && (
        <div
          style={{
            background: '#fee',
            padding: 12,
            borderRadius: 4,
            marginBottom: 16,
            color: '#c00',
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 4 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 4 }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: 12,
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          {loading ? 'Unlocking...' : 'Unlock'}
        </button>
      </form>

      <p style={{ marginTop: 16, fontSize: 14, color: '#666', textAlign: 'center' }}>
        This page must be served from your vault server's origin to work.
      </p>
    </div>
  );
}
