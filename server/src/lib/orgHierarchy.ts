// Org hierarchy + coverage-chain access resolver (Phase 1: defined and tested,
// not yet wired into read queries — Phase 2 applies it). See
// docs/ORG-HIERARCHY-DESIGN.md.
//
// Row-level access follows the PLAN, not a rigid org subtree:
//   • a company/employer sees the members it administers (members.org_id = self)
//   • an HMO sees members enrolled in the plans it OFFERS (+ its own retail members)
//   • an insurer sees members enrolled in the plans it UNDERWRITES (+ its own)
//   • the platform org sees all
// parent_org_id is the administrative/default link (onboarding, billing, default
// catalogue) and drives the descendant/ancestor helpers below — not member access.

import { query } from '../config/database';

export type MemberScope = 'own' | 'offered-plans' | 'underwritten-plans' | 'all';

// Which members an org's staff may see, by org type.
export function memberAccessScope(orgType: string | null | undefined, isPlatform = false): MemberScope {
  if (isPlatform) return 'all';
  switch (String(orgType)) {
    case 'hmo': return 'offered-plans';
    case 'underwriter': return 'underwritten-plans';
    default: return 'own'; // company + other demand orgs administer their own members
  }
}

// Build a WHERE fragment (and params) that scopes a members query to what `actor`
// may see. `alias` is the members-table alias in the caller's query; `startIndex`
// is the first positional-parameter number to use. Wired for Phase 2.
export function memberVisibilityClause(
  actor: { orgId: string; orgType?: string | null; isPlatform?: boolean },
  alias = 'm',
  startIndex = 1,
): { sql: string; params: unknown[] } {
  const scope = memberAccessScope(actor.orgType, actor.isPlatform);
  if (scope === 'all') return { sql: 'TRUE', params: [] };

  const p = `$${startIndex}`;
  const own = `${alias}.org_id = ${p}`;

  if (scope === 'offered-plans' || scope === 'underwritten-plans') {
    const planCol = scope === 'offered-plans' ? 'offered_by_org_id' : 'underwriter_org_id';
    return {
      sql: `(${own} OR ${alias}.id IN (
        SELECT e.member_id FROM enrolments e
          JOIN insurance_plans pl ON pl.id = e.plan_id
         WHERE pl.${planCol} = ${p}))`,
      params: [actor.orgId],
    };
  }
  return { sql: own, params: [actor.orgId] };
}

// All org ids at or below `orgId` in the parent_org_id tree (includes self).
export async function descendantOrgIds(orgId: string): Promise<string[]> {
  const r = await query(
    `WITH RECURSIVE tree AS (
       SELECT id FROM organisations WHERE id = $1
       UNION ALL
       SELECT o.id FROM organisations o JOIN tree t ON o.parent_org_id = t.id
     ) SELECT id FROM tree`,
    [orgId],
  );
  return r.rows.map((x) => x.id as string);
}

// All ancestor org ids above `orgId` (excludes self).
export async function ancestorOrgIds(orgId: string): Promise<string[]> {
  const r = await query(
    `WITH RECURSIVE chain AS (
       SELECT id, parent_org_id FROM organisations WHERE id = $1
       UNION ALL
       SELECT o.id, o.parent_org_id FROM organisations o JOIN chain c ON o.id = c.parent_org_id
     ) SELECT id FROM chain WHERE id <> $1`,
    [orgId],
  );
  return r.rows.map((x) => x.id as string);
}

// Would making `parentId` the parent of `orgId` create a cycle? (self, or an
// existing descendant becoming the parent). Guards re-parenting.
export async function wouldCreateCycle(orgId: string, parentId: string): Promise<boolean> {
  if (!parentId || orgId === parentId) return orgId === parentId;
  const descendants = await descendantOrgIds(orgId);
  return descendants.includes(parentId);
}
