import { describe, it, expect } from 'vitest';
import {
  ownerCanViewPhi, redactMemberPhi, redactConsultationsPhi,
} from '../src/lib/memberProjection';

// The single most important privacy guarantee: who may see clinical PHI, and
// that redaction actually strips it. A regression here is a data-safety incident.
describe('PHI visibility (ownerCanViewPhi)', () => {
  it('HMOs / underwriters may see PHI', () => {
    expect(ownerCanViewPhi('underwriter', false)).toBe(true);
  });

  it('employers and other demand orgs may NOT see PHI', () => {
    expect(ownerCanViewPhi('company', false)).toBe(false);
    expect(ownerCanViewPhi('telco', false)).toBe(false);
    expect(ownerCanViewPhi('fintech', false)).toBe(false);
    expect(ownerCanViewPhi('cooperative', false)).toBe(false);
  });

  it('platform admins may see PHI regardless of org type', () => {
    expect(ownerCanViewPhi('company', true)).toBe(true);
    expect(ownerCanViewPhi(null, true)).toBe(true);
  });

  it('unknown / missing org type defaults to NO PHI', () => {
    expect(ownerCanViewPhi(null, false)).toBe(false);
    expect(ownerCanViewPhi(undefined, false)).toBe(false);
    expect(ownerCanViewPhi('', false)).toBe(false);
  });
});

describe('redactMemberPhi', () => {
  const member = {
    id: 'm1', full_name: 'Ada Obi', membership_id: 'MOB-1', status: 'active',
    date_of_birth: '1990-01-01', phone: '+2348012345678',
    chronic_conditions: ['asthma'], allergies: ['penicillin'],
    current_medications: ['ventolin'], blood_group: 'O+',
  };

  it('strips every clinical/contact PHI field', () => {
    const out = redactMemberPhi(member) as Record<string, unknown>;
    for (const f of ['date_of_birth', 'phone', 'chronic_conditions', 'allergies', 'current_medications', 'blood_group']) {
      expect(out[f]).toBeUndefined();
    }
  });

  it('keeps non-PHI identifiers and status', () => {
    const out = redactMemberPhi(member);
    expect(out.full_name).toBe('Ada Obi');
    expect(out.membership_id).toBe('MOB-1');
    expect(out.status).toBe('active');
  });

  it('does not mutate the original object', () => {
    redactMemberPhi(member);
    expect(member.phone).toBe('+2348012345678');
    expect(member.chronic_conditions).toEqual(['asthma']);
  });
});

describe('redactConsultationsPhi', () => {
  it('strips clinical free-text but keeps utilisation context', () => {
    const rows = [{
      id: 'c1', mode: 'video', status: 'completed', created_at: '2026-01-01',
      reason: 'chest pain', notes: 'reviewed', diagnosis: 'angina',
    }];
    const [out] = redactConsultationsPhi(rows);
    expect(out.reason).toBeUndefined();
    expect(out.notes).toBeUndefined();
    expect(out.diagnosis).toBeUndefined();
    expect(out.mode).toBe('video');
    expect(out.status).toBe('completed');
    expect(out.created_at).toBe('2026-01-01');
  });
});
