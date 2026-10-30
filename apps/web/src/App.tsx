import { useState } from 'react';
import { Login } from './components/Login';
import { TotpList } from './components/TotpList';
import { getTotpLogins, type TotpCode } from './lib/auth';

export function App() {
  const [session, setSession] = useState<string | null>(null);
  const [logins, setLogins] = useState<TotpCode[]>([]);

  function handleUnlock(session: string) {
    setSession(session);
    // Fetch TOTP logins immediately after unlock
    getTotpLogins(session)
      .then((items) => {
        setLogins(items);
      })
      .catch((err) => {
        console.error('Failed to fetch items:', err);
        setSession(null);
      });
  }

  function handleLock() {
    setSession(null);
    setLogins([]);
  }

  if (!session) {
    return <Login onUnlock={handleUnlock} />;
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <h1 style={{ color: 'white' }}>OxVault Web — TOTP Authenticator</h1>
        <button
          onClick={handleLock}
          style={{
            padding: '8px 16px',
            background: 'rgba(255,255,255,0.2)',
            color: 'white',
            border: '1px solid white',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Lock Vault
        </button>
      </div>

      <TotpList logins={logins} />
    </>
  );
}
