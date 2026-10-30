import { useEffect, useState } from 'react';
import type { TotpCode } from '../lib/auth';
import * as OTPAuth from 'otpauth';

export function TotpList({ logins }: { logins: TotpCode[] }) {
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});

  // Compute TOTP codes and update every second
  useEffect(() => {
    const computeAll = () => {
      const newCodes: Record<string, string> = {};
      const newCountdowns: Record<string, number> = {};

      for (const login of logins) {
        try {
          const otp = new OTPAuth.TOTP({
            secret: OTPAuth.Secret.fromBase32(login.secret),
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
          });

          const code = otp.generate();
          const remaining = Math.ceil(30 - ((Date.now() / 1000) % 30));

          newCodes[login.id] = code;
          newCountdowns[login.id] = remaining;
        } catch (err) {
          console.error(`Failed to generate TOTP for ${login.name}:`, err);
        }
      }

      setCodes(newCodes);
      setCountdowns(newCountdowns);
    };

    computeAll();
    const interval = setInterval(computeAll, 1000);
    return () => clearInterval(interval);
  }, [logins]);

  async function copyCode(id: string, name: string) {
    const code = codes[id];
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      // Simple toast could go here
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  if (logins.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <p>No TOTP items found in your vault.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 24 }}>Your TOTP Codes</h1>

      <div style={{ display: 'grid', gap: 16 }}>
        {logins.map((login) => (
          <div
            key={login.id}
            style={{
              background: 'white',
              padding: 16,
              borderRadius: 8,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ marginBottom: 4 }}>{login.name}</h3>
                <span style={{ fontSize: 12, color: '#666' }}>
                  Expires in {countdowns[login.id] || 30}s
                </span>
              </div>
              <button
                onClick={() => copyCode(login.id, login.name)}
                disabled={!codes[login.id]}
                style={{
                  padding: '8px 16px',
                  background: codes[login.id] ? '#667eea' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: codes[login.id] ? 'pointer' : 'not-allowed',
                  minWidth: 80,
                }}
              >
                {codes[login.id] ? 'Copy' : 'Loading...'}
              </button>
            </div>

            <div
              style={{
                marginTop: 12,
                padding: 12,
                background: '#f5f5f5',
                borderRadius: 4,
                fontFamily: 'monospace',
                fontSize: 24,
                textAlign: 'center',
                letterSpacing: 4,
                fontWeight: 600,
                color: '#333',
              }}
            >
              {codes[login.id] || '••••••'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
