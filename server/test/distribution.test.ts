import { describe, it, expect } from 'vitest';
import {
  generateDistributionKey, distKeyPrefix, quotePremium, productView, generatePartnerWebhookSecret,
} from '../src/lib/distribution';

describe('distribution keys', () => {
  it('mints a mk_dist_ key with a matching 16-char prefix and a sha256 hash', () => {
    const k = generateDistributionKey();
    expect(k.fullKey.startsWith('mk_dist_')).toBe(true);
    expect(k.prefix).toBe(k.fullKey.slice(0, 16));
    expect(distKeyPrefix(k.fullKey)).toBe(k.prefix);
    expect(k.hash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
    // Distinct from public keys and unique per call.
    expect(k.fullKey.startsWith('mk_live_')).toBe(false);
    expect(generateDistributionKey().fullKey).not.toBe(k.fullKey);
  });

  it('webhook secret uses the whsec_ scheme', () => {
    expect(generatePartnerWebhookSecret().startsWith('whsec_')).toBe(true);
  });
});

describe('quote + product view', () => {
  const plan = {
    id: 'p1', name: 'Essential Health Cover', plan_type: 'individual',
    monthly_premium: '2500', currency: 'NGN', cover_amount: '1500000',
    benefits: ['Telemedicine', 'Outpatient'], description: 'Entry-level cover',
  };
  it('quotes the plan premium as a number', () => {
    const q = quotePremium(plan);
    expect(q).toEqual({ currency: 'NGN', monthlyPremium: 2500 });
  });
  it('exposes a clean product shape with numeric money fields', () => {
    const v = productView(plan);
    expect(v).toMatchObject({
      planId: 'p1', name: 'Essential Health Cover', type: 'individual',
      currency: 'NGN', monthlyPremium: 2500, coverAmount: 1500000,
    });
    expect(v.benefits).toEqual(['Telemedicine', 'Outpatient']);
  });
});
