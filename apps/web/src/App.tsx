import { useEffect, useState } from 'react';
import { Login } from './components/Login';
import { TotpList } from './components/TotpList';
import { assertSecureDeployment } from './lib/guard';
import { startTicker, type DisplayCode } from './lib/codes';
import type { TotpEntry } from './lib/secrets';

export function App() {
  const [guardError, setGuardError] = useState<string | null>(null);
  const [entries, setEntries] = useState<TotpEntry[]>([]);
  const [codes, setCodes] = useState<DisplayCode[]>([]);

  // Guard check on mount
  useEffect(() => {
    try {
      assertSecureDeployment();
    } catch (err) {
      setGuardError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // Clear in-memory entries on blur (tab switch / loss of focus)
  useEffect(() => {
    function handleBlur() {
      setEntries([]);
      setCodes([]);
    }
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, []);

  // Run ticker when entries are present; clean up on unmount or when entries clear
  useEffect(() => {
    if (entries.length === 0) {
      setCodes([]);
      return;
    }
    const ticker = startTicker({
      entries,
      onCodes: setCodes,
    });
    return () => ticker.stop();
  }, [entries]);

  function handleLock() {
    setEntries([]);
    setCodes([]);
  }

  // Fatal deployment guard panel
  if (guardError) {
    return (
      <div
        style={{
          maxWidth: 480,
          margin: '0 auto',
          background: '#fee2e2',
          border: '1px solid #ef4444',
          borderRadius: 8,
          padding: 24,
          color: '#991b1b',
        }}
      >
        <h2 style={{ margin: '0 0 12px 0', fontSize: 18, color: '#b91c1c' }}>
          Deployment Not Allowed
        </h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{guardError}</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return <Login onAdd={setEntries} />;
  }

  return (
    <div style={{ width: '100%', maxWidth: 600, margin: '0 auto', padding: '0 16px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <h1 style={{ color: 'white', fontSize: 22, margin: 0 }}>OxVault Authenticator</h1>
        <button
          type="button"
          onClick={handleLock}
          style={{
            padding: '8px 16px',
            background: 'rgba(255,255,255,0.2)',
            color: 'white',
            border: '1px solid white',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Lock
        </button>
      </div>

      <TotpList codes={codes} />
    </div>
  );
}
