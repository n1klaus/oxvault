import { useState, type FormEvent } from 'react';
import { addFromText, type TotpEntry } from '../lib/secrets';

export interface LoginProps {
  onAdd?: (entries: TotpEntry[]) => void;
}

export function Login({ onAdd }: LoginProps) {
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const { entries: parsed, skipped } = addFromText(text, label.trim() || undefined);
    if (parsed.length === 0) {
      if (skipped.length > 0) {
        // Precise reason for an all-rejected paste beats the generic error.
        setError(
          `${skipped.length} line${skipped.length > 1 ? 's' : ''} skipped (invalid TOTP parameters): ${skipped[0]}`,
        );
      } else {
        setError('No valid TOTP entries found. Enter a valid TOTP URI or base32 secret.');
      }
      return;
    }

    if (skipped.length > 0) {
      setNotice(
        `${skipped.length} line${skipped.length > 1 ? 's' : ''} skipped (invalid TOTP parameters): ${skipped[0]}`,
      );
    }

    if (onAdd) {
      onAdd(parsed);
    }

    setText('');
    setLabel('');
  }

  return (
    <div
      style={{
        maxWidth: 480,
        margin: '0 auto',
        background: 'white',
        padding: 32,
        borderRadius: 8,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      }}
    >
      <h1 style={{ marginBottom: 8, textAlign: 'center' }}>OxVault Authenticator</h1>
      <p style={{ marginBottom: 24, fontSize: 14, color: '#666', textAlign: 'center' }}>
        Local in-memory TOTP authenticator. Secrets are never saved or sent to any server.
      </p>

      {error && (
        <div
          style={{
            background: '#fee',
            padding: 12,
            borderRadius: 4,
            marginBottom: 16,
            color: '#c00',
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          style={{
            background: '#fefce8',
            border: '1px solid #facc15',
            padding: 12,
            borderRadius: 4,
            marginBottom: 16,
            color: '#854d0e',
            fontSize: 13,
            wordBreak: 'break-all',
          }}
        >
          {notice}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
            Label (optional)
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Account name or label"
            style={{
              width: '100%',
              padding: 10,
              border: '1px solid #ccc',
              borderRadius: 4,
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
            TOTP Secrets or URIs (one per line)
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            required
            placeholder="Paste otpauth:// URIs or base32 secrets, one per line"
            style={{
              width: '100%',
              padding: 10,
              border: '1px solid #ccc',
              borderRadius: 4,
              fontSize: 13,
              fontFamily: 'monospace',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </div>

        <button
          type="submit"
          style={{
            width: '100%',
            padding: 12,
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          Generate Codes
        </button>
      </form>
    </div>
  );
}
