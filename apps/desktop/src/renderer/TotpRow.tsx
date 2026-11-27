import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from '@phosphor-icons/react';
import { totpRefreshDelay, type TotpCode } from '@oxvault/shared/totp';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

/** Shows the current one-time code for a login, derived in the main process. */
export function TotpRow({
  itemId,
  disabled,
  onError,
}: {
  itemId: string;
  disabled: boolean;
  onError?: (message: string) => void;
}) {
  const [totp, setTotp] = useState<TotpCode | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [expired, setExpired] = useState(false);
  const [copied, setCopied] = useState(false);
  const lifetime = useRef({ active: true });
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    // A fresh object per effect run: a pending copy from a previous itemId fails this check.
    const mine = { active: true };
    lifetime.current = mine;
    let ticker: ReturnType<typeof setInterval> | undefined;
    let next: ReturnType<typeof setTimeout> | undefined;
    let expiresAt = 0;

    setTotp(null);
    setRemaining(0);
    setExpired(false);
    setCopied(false);

    const label = () => {
      const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) setExpired(true);
    };

    const hide = () => {
      if (ticker) clearInterval(ticker);
      ticker = undefined;
      setTotp(null);
      setRemaining(0);
    };

    async function refresh(attempt = 0) {
      clearTimeout(next);
      next = undefined;
      try {
        const result = await window.oxvault.totp(itemId);
        if (!mine.active) return;
        if (!result.ok || !result.value) {
          // One retry keeps a transient IPC failure from hiding the row.
          if (attempt === 0) next = setTimeout(() => void refresh(1), 1000);
          else hide();
          return;
        }
        const value = result.value;
        if (value.expiresAt <= Date.now()) {
          // The read landed after its period; show nothing until the next one.
          setExpired(true);
          next = setTimeout(() => void refresh(), 25);
          return;
        }
        expiresAt = value.expiresAt;
        setTotp(value);
        setExpired(false);
        label();
        if (ticker) clearInterval(ticker);
        ticker = setInterval(label, 1000);
        next = setTimeout(() => {
          setExpired(true);
          void refresh();
        }, totpRefreshDelay(expiresAt));
      } catch {
        if (!mine.active) return;
        if (attempt === 0) next = setTimeout(() => void refresh(1), 1000);
        else hide();
      }
    }

    void refresh();
    return () => {
      mine.active = false;
      if (ticker) clearInterval(ticker);
      clearTimeout(next);
      clearTimeout(copiedTimer.current);
    };
  }, [itemId]);

  if (!totp) return null;
  const grouped = expired
    ? '······'
    : totp.code.length === 6
      ? `${totp.code.slice(0, 3)} ${totp.code.slice(3)}`
      : totp.code;

  async function copy() {
    if (!totp) return;
    const mine = lifetime.current;
    try {
      // Through the main process, so the clipboard clears after 30 s like a password copy.
      const result = await window.oxvault.copyTotp(itemId);
      if (!mine.active) return;
      setCopied(result.ok);
      if (result.ok) {
        clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => setCopied(false), 2000);
      } else onError?.(result.error);
    } catch {
      if (!mine.active) return;
      setCopied(false);
      onError?.('Could not copy. Try again.');
    }
  }

  return (
    <>
      <Separator />
      <div className="task-credential" data-credential="totp">
        <div>
          <p id="detail-totp-label" className="text-xs text-muted-foreground">
            Verification code
          </p>
          <span className="field-value text-sm font-mono" aria-labelledby="detail-totp-label">
            {grouped}
          </span>
          <span role="timer" aria-live="off" className="text-xs text-muted-foreground">
            {expired ? 'Expired' : `${remaining}s left`}
          </span>
          <span role="status" className="sr-only">
            {copied ? 'Verification code copied' : ''}
          </span>
        </div>
        <div className="task-actions">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Copy verification code"
            disabled={disabled}
            onClick={() => void copy()}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
      </div>
    </>
  );
}
