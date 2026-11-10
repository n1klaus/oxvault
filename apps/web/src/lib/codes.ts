import { totpFromField } from '@oxvault/shared/totp';
import type { TotpEntry } from './secrets';

export interface DisplayCode {
  id: string;
  label: string;
  code: string;
  remaining: number;
  period: number;
}

export interface TickerOptions {
  entries: TotpEntry[];
  clock?: () => number;
  schedule?: (fn: () => void, delayMs: number) => any;
  onCodes: (codes: DisplayCode[]) => void;
}

/**
 * Compute the current TOTP codes for the provided entries at nowMs.
 * Clamps remaining countdown to [1, period].
 */
export async function currentCodes(
  entries: TotpEntry[],
  nowMs: number = Date.now(),
): Promise<DisplayCode[]> {
  const results: DisplayCode[] = [];
  for (const entry of entries) {
    const totp = await totpFromField(entry.entry, nowMs);
    if (totp) {
      const remaining = Math.max(1, Math.min(totp.period, totp.remaining));
      results.push({
        id: entry.id,
        label: entry.label,
        code: totp.code,
        remaining,
        period: totp.period,
      });
    }
  }
  return results;
}

/**
 * Starts a timer ticker that calculates current codes and schedules updates
 * at 25ms after the next earliest code expiry. No fixed interval.
 */
export function startTicker({
  entries,
  clock = () => Date.now(),
  schedule = (fn, delay) => setTimeout(fn, delay),
  onCodes,
}: TickerOptions): { stop: () => void } {
  let stopped = false;
  let timerHandle: any;

  const tick = async () => {
    if (stopped) return;
    const now = clock();
    const codes = await currentCodes(entries, now);
    if (stopped) return;
    onCodes(codes);
    if (codes.length === 0) return;

    let minDeadline = Infinity;
    for (const c of codes) {
      const deadline = now + c.remaining * 1000;
      if (deadline < minDeadline) {
        minDeadline = deadline;
      }
    }

    const currentNow = clock();
    const delay = minDeadline - currentNow + 25;
    if (stopped) return;
    timerHandle = schedule(tick, delay);
  };

  tick();

  return {
    stop() {
      stopped = true;
      if (typeof timerHandle === 'function') {
        timerHandle();
      } else if (timerHandle && typeof timerHandle.cancel === 'function') {
        timerHandle.cancel();
      } else if (timerHandle !== undefined) {
        clearTimeout(timerHandle);
      }
    },
  };
}
