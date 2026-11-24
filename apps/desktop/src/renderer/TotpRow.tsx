import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from '@phosphor-icons/react';
import type { TotpCode } from '@oxvault/shared/totp';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

/** Shows the current one-time code for a login, derived in the main process. */
export function TotpRow({ itemId, disabled }: { itemId: string; disabled: boolean }) {
  const [totp, setTotp] = useState<TotpCode | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [copied, setCopied] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    setTotp(null);
    setRemaining(0);
    setCopied(false);
    let ticker: ReturnType<typeof setInterval> | undefined;
    let expiresAt = 0;

    async function refresh() {
      if (ticker) {
        clearInterval(ticker);
        ticker = undefined;
      }
      try {
        const result = await window.oxvault.totp(itemId);
        if (cancelled) return;
        if (!result.ok || !result.value) {
          setTotp(null);
          return;
        }
        const value = result.value;
        setTotp(value);
        expiresAt = Date.now() + value.remaining * 1000;
        setRemaining(value.remaining);
        ticker = setInterval(() => {
          if (cancelled) return;
          const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
          setRemaining(left);
          if (left === 0) {
            if (ticker) clearInterval(ticker);
            ticker = undefined;
            void refresh();
          }
        }, 1000);
      } catch {
        if (!cancelled) setTotp(null);
      }
    }

    void refresh();
    return () => {
      cancelled = true;
      alive.current = false;
      if (ticker) clearInterval(ticker);
    };
  }, [itemId]);

  if (!totp) return null;
  const grouped =
    totp.code.length === 6 ? `${totp.code.slice(0, 3)} ${totp.code.slice(3)}` : totp.code;

  async function copy() {
    if (!totp) return;
    try {
      // Through the main process, so the clipboard clears after 30 s like a password copy.
      const result = await window.oxvault.copyTotp(itemId);
      setCopied(result.ok);
      if (result.ok) setTimeout(() => alive.current && setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <Separator />
      <div className="task-credential" data-credential="totp">
        <div>
          <p id="detail-totp-label" className="text-xs text-muted-foreground">
            Verification code · {remaining}s
          </p>
          <span className="field-value text-sm font-mono" aria-labelledby="detail-totp-label">
            {grouped}
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
