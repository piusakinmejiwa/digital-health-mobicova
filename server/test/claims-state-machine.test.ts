import { describe, it, expect } from 'vitest';
import {
  canTransition, isClaimStatus, isClaimType, generateClaimReference,
} from '../src/lib/claims';

// The claim adjudication lifecycle. Illegal jumps (e.g. submitted → paid, or
// moving a terminal claim) must stay blocked — money + audit integrity depend on it.
describe('claim state machine (canTransition)', () => {
  it('allows the valid forward moves', () => {
    expect(canTransition('submitted', 'under_review')).toBe(true);
    expect(canTransition('submitted', 'approved')).toBe(true);
    expect(canTransition('submitted', 'rejected')).toBe(true);
    expect(canTransition('under_review', 'approved')).toBe(true);
    expect(canTransition('approved', 'paid')).toBe(true);
    expect(canTransition('approved', 'rejected')).toBe(true);
  });

  it('blocks skipping straight to paid', () => {
    expect(canTransition('submitted', 'paid')).toBe(false);
    expect(canTransition('under_review', 'paid')).toBe(false);
  });

  it('blocks any move out of a terminal status', () => {
    for (const to of ['submitted', 'under_review', 'approved', 'rejected', 'paid']) {
      expect(canTransition('rejected', to)).toBe(false);
      expect(canTransition('paid', to)).toBe(false);
    }
  });

  it('rejects unknown statuses', () => {
    expect(canTransition('submitted', 'banana')).toBe(false);
    expect(canTransition('banana', 'approved')).toBe(false);
  });
});

describe('claim validators', () => {
  it('isClaimStatus', () => {
    expect(isClaimStatus('approved')).toBe(true);
    expect(isClaimStatus('nope')).toBe(false);
    expect(isClaimStatus(42)).toBe(false);
  });

  it('isClaimType', () => {
    expect(isClaimType('outpatient')).toBe(true);
    expect(isClaimType('not-a-type')).toBe(false);
  });

  it('generateClaimReference is uniquely-shaped', () => {
    const ref = generateClaimReference();
    expect(ref).toMatch(/^CLM-[A-Z0-9]+$/);
    expect(generateClaimReference()).not.toBe(ref);
  });
});
