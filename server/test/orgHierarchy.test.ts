import { describe, it, expect } from 'vitest';
import { memberAccessScope, memberVisibilityClause } from '../src/lib/orgHierarchy';

describe('memberAccessScope', () => {
  it('company + other demand/supply orgs see their own members', () => {
    expect(memberAccessScope('company')).toBe('own');
    expect(memberAccessScope('telco')).toBe('own');
    expect(memberAccessScope('clinic')).toBe('own');
  });
  it('hmo sees members on the plans it offers', () => {
    expect(memberAccessScope('hmo')).toBe('offered-plans');
  });
  it('underwriter sees members on the plans it underwrites', () => {
    expect(memberAccessScope('underwriter')).toBe('underwritten-plans');
  });
  it('the platform org sees all', () => {
    expect(memberAccessScope('company', true)).toBe('all');
    expect(memberAccessScope('hmo', true)).toBe('all');
  });
});

describe('memberVisibilityClause', () => {
  const actor = (orgType: string, isPlatform = false) => ({ orgId: 'org-1', orgType, isPlatform });

  it('company → own org only', () => {
    const c = memberVisibilityClause(actor('company'));
    expect(c.sql).toBe('m.org_id = $1');
    expect(c.params).toEqual(['org-1']);
  });
  it('hmo → own OR members on offered plans', () => {
    const c = memberVisibilityClause(actor('hmo'));
    expect(c.sql).toContain('m.org_id = $1');
    expect(c.sql).toContain('offered_by_org_id = $1');
    expect(c.params).toEqual(['org-1']);
  });
  it('underwriter → own OR members on underwritten plans', () => {
    const c = memberVisibilityClause(actor('underwriter'));
    expect(c.sql).toContain('underwriter_org_id = $1');
    expect(c.params).toEqual(['org-1']);
  });
  it('platform → TRUE with no params', () => {
    const c = memberVisibilityClause(actor('company', true));
    expect(c.sql).toBe('TRUE');
    expect(c.params).toEqual([]);
  });
  it('honours a custom alias and start index', () => {
    const c = memberVisibilityClause(actor('company'), 'mem', 3);
    expect(c.sql).toBe('mem.org_id = $3');
  });
});
