import { describe, it, expect } from 'vitest';
import { tierFor, nextTierFor, isUnlimited, TIERS } from '../src/lib/plans';

// Plan tier resolution + the seat-cap ladder. A regression that mis-maps a tier
// or treats a finite limit as unlimited would silently break billing enforcement.
describe('tierFor', () => {
  it('resolves a known plan key', () => {
    expect(tierFor('growth').limits.members).toBe(10000);
    expect(tierFor('scale').key).toBe('scale');
  });

  it('falls back to the first tier for unknown / null keys', () => {
    expect(tierFor('nonexistent').key).toBe(TIERS[0].key);
    expect(tierFor(null).key).toBe(TIERS[0].key);
    expect(tierFor(undefined).key).toBe(TIERS[0].key);
  });
});

describe('isUnlimited', () => {
  it('only the enterprise tier is unlimited on members', () => {
    expect(isUnlimited(tierFor('enterprise').limits.members)).toBe(true);
    expect(isUnlimited(tierFor('starter').limits.members)).toBe(false);
    expect(isUnlimited(10000)).toBe(false);
  });
});

describe('nextTierFor', () => {
  it('suggests the next bigger tier', () => {
    const starter = tierFor('starter');
    expect(nextTierFor(starter, 'members')?.key).toBe('growth');
  });

  it('returns null when already at the top', () => {
    const enterprise = tierFor('enterprise');
    expect(nextTierFor(enterprise, 'members')).toBeNull();
  });
});
