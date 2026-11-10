import { useEffect, useRef, useState } from 'react';
import type { DisplayCode } from '../lib/codes';

export interface TotpListProps {
  codes?: DisplayCode[];
}

export function TotpList({ codes }: TotpListProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const items = codes ?? [];

  // Clear any pending toast timer on unmount so a late setState can't fire.
  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    };
  }, []);

  async function copyCode(id: string, code: string) {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      if (toastTimer.current !== null) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  }

  if (items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 48, background: 'white', borderRadius: 8 }}>
        <p style={{ color: '#666' }}>No TOTP items active.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'grid', gap: 16 }}>
        {items.map((item) => {
          const countdown = Math.max(1, Math.min(item.period, item.remaining));
          return (
            <div
              key={item.id}
              style={{
                background: 'white',
                padding: 16,
                borderRadius: 8,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: 16, color: '#333' }}>{item.label}</h3>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 'bold',
                    letterSpacing: 4,
                    color: '#2d3748',
                    fontFamily: 'monospace',
                  }}
                >
                  {item.code || '------'}
                </div>
                <span style={{ fontSize: 12, color: '#666' }}>
                  Expires in {countdown}s ({item.period}s period)
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyCode(item.id, item.code)}
                disabled={!item.code}
                style={{
                  padding: '8px 16px',
                  background: copiedId === item.id ? '#48bb78' : '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: item.code ? 'pointer' : 'not-allowed',
                  minWidth: 80,
                  fontSize: 14,
                  fontWeight: 500,
                  transition: 'background 0.2s ease',
                }}
              >
                {copiedId === item.id ? 'Copied!' : 'Copy'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
