import { describe, it, expect } from 'vitest';
import { memberAccessScope, memberVisibilityClause, coverageChainClause } from '../src/lib/orgHierarchy';

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

describe('coverageChainClause — member-linked entities (e.g. claims)', () => {
  const actor = (orgType: string) => ({ orgId: 'org-1', orgType });

  it('company → the entity’s own org', () => {
    const c = coverageChainClause(actor('company'), { alias: 'c', memberCol: 'member_id' });
    expect(c.sql).toBe('c.org_id = $1');
    expect(c.params).toEqual(['org-1']);
  });
  it('hmo → own OR the row’s member is on an offered plan', () => {
    const c = coverageChainClause(actor('hmo'), { alias: 'c', memberCol: 'member_id' });
    expect(c.sql).toContain('c.org_id = $1');
    expect(c.sql).toContain('c.member_id IN');
    expect(c.sql).toContain('offered_by_org_id = $1');
  });
  it('underwriter → own OR the row’s member is on an underwritten plan', () => {
    const c = coverageChainClause(actor('underwriter'), { alias: 'c', memberCol: 'member_id' });
    expect(c.sql).toContain('c.member_id IN');
    expect(c.sql).toContain('underwriter_org_id = $1');
  });
  it('empty alias → unqualified columns (for alias-less subqueries, e.g. reports)', () => {
    expect(coverageChainClause(actor('company'), { alias: '', memberCol: 'member_id' }).sql).toBe('org_id = $1');
    const hmo = coverageChainClause(actor('hmo'), { alias: '', memberCol: 'member_id' }).sql;
    expect(hmo).toContain('org_id = $1');
    expect(hmo).toContain('OR member_id IN'); // outer column unqualified (subquery keeps cc_e.member_id)
  });
});
