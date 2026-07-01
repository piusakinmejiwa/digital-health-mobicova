import { describe, it, expect } from 'vitest';
import { computePremiumSplit, billingPeriod } from '../src/lib/settlement';

describe('computePremiumSplit', () => {
  it('splits a ₦2,500 premium at 15% commission + 2% platform fee', () => {
    const s = computePremiumSplit(2500, 15, 2);
    expect(s).toEqual({
      gross: 2500, commissionRate: 15, commission: 375,
      platformFeeRate: 2, platformFee: 50, levy: 0, net: 2075,
    });
    // The parts reconcile back to gross.
    expect(s.commission + s.platformFee + s.levy + s.net).toBeCloseTo(s.gross, 2);
  });

  it('rounds to 2dp and never goes below zero on gross', () => {
    const s = computePremiumSplit(999.99, 12.5, 1.75, 10);
    expect(s.commission).toBe(125); // 999.99 * 0.125 = 124.99875 -> 125.00
    expect(s.platformFee).toBe(17.5); // 999.99 * 0.0175 = 17.499825 -> 17.50
    expect(s.levy).toBe(10);
    expect(s.net).toBeCloseTo(s.gross - s.commission - s.platformFee - s.levy, 2);
    expect(computePremiumSplit(-50, 10, 1).gross).toBe(0);
  });

  it('zero rates leave the whole premium as net', () => {
    expect(computePremiumSplit(1000, 0, 0)).toMatchObject({ commission: 0, platformFee: 0, net: 1000 });
  });
});

describe('billingPeriod (WAT)', () => {
  it('formats YYYY-MM in WAT', () => {
    expect(billingPeriod(new Date('2026-07-15T10:00:00Z'))).toBe('2026-07');
  });
  it('rolls a UTC month-end into the next month at the WAT boundary', () => {
    // 2026-06-30 23:30 UTC is 2026-07-01 00:30 WAT.
    expect(billingPeriod(new Date('2026-06-30T23:30:00Z'))).toBe('2026-07');
  });
});
