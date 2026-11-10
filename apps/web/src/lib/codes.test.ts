import { describe, expect, it } from 'vite-plus/test';
import { currentCodes, startTicker } from './codes';
import type { TotpEntry } from './secrets';

describe('codes', () => {
  const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  const rfcEntry: TotpEntry = {
    id: 'rfc-test-entry',
    label: 'RFC 6238 Vector',
    entry: `otpauth://totp/RFC6238?secret=${rfcSecret}&digits=8&period=30&algorithm=SHA1`,
    period: 30,
    digits: 8,
    algorithm: 'SHA-1',
    steam: false,
  };

  it('yields RFC 6238 vector 94287082 at T=59s with fixed clock', async () => {
    // T = 59s -> 59000 ms. RFC 6238 documented vector: 94287082
    const codes = await currentCodes([rfcEntry], 59_000);

    expect(codes).toHaveLength(1);
    expect(codes[0].id).toBe('rfc-test-entry');
    expect(codes[0].label).toBe('RFC 6238 Vector');
    expect(codes[0].code).toBe('94287082');
    expect(codes[0].period).toBe(30);
    expect(codes[0].remaining).toBe(1);
  });

  it('clamps remaining countdown into [1, period]', async () => {
    // At T=0s: remaining is period (30)
    const atZero = await currentCodes([rfcEntry], 0);
    expect(atZero[0].remaining).toBe(30);
    expect(atZero[0].remaining).toBeLessThanOrEqual(rfcEntry.period);

    // At T=29s (end of first window): remaining is 1
    const at29s = await currentCodes([rfcEntry], 29_000);
    expect(at29s[0].remaining).toBe(1);
    expect(at29s[0].remaining).toBeGreaterThanOrEqual(1);

    // At T=59s (end of second window): remaining is 1
    const at59s = await currentCodes([rfcEntry], 59_000);
    expect(at59s[0].remaining).toBe(1);

    // At T=60s (start of third window): remaining resets to 30
    const at60s = await currentCodes([rfcEntry], 60_000);
    expect(at60s[0].remaining).toBe(30);
  });

  it('startTicker requests exactly one delay equal to deadline - now + 25 and stop() cancels it', async () => {
    const fixedNow = 10_000; // 10s into 30s period -> remaining = 20s
    // deadline = 10_000 + 20 * 1000 = 30_000
    // delay = deadline - now + 25 = 30_000 - 10_000 + 25 = 20_025
    let scheduledDelay: number | null = null;
    let scheduleCalls = 0;
    let cancelled = false;
    let receivedCodes: any[] = [];

    await new Promise<void>((resolve) => {
      let ticker: { stop: () => void };
      ticker = startTicker({
        entries: [rfcEntry],
        clock: () => fixedNow,
        schedule: (_fn, delay) => {
          scheduleCalls++;
          scheduledDelay = delay;
          queueMicrotask(() => {
            ticker.stop();
            resolve();
          });
          return () => {
            cancelled = true;
          };
        },
        onCodes: (codes) => {
          receivedCodes = codes;
        },
      });
    });

    const expectedDelay = 30_000 - fixedNow + 25;
    expect(scheduleCalls).toBe(1);
    expect(scheduledDelay).toBe(expectedDelay);
    expect(scheduledDelay).toBe(20_025);
    expect(cancelled).toBe(true);
    expect(receivedCodes).toHaveLength(1);
    expect(receivedCodes[0].remaining).toBe(20);
    expect(receivedCodes[0].code).toBe('84755224');
  });
});
