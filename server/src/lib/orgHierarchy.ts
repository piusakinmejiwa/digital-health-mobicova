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

export interface CoverageActor { orgId: string; orgType?: string | null; isPlatform?: boolean }

// Build a WHERE fragment (and params) that scopes any MEMBER-LINKED table to what
// `actor` may see via the coverage chain. Works for members (memberCol='id'),
// claims/enrolments (memberCol='member_id'), etc. `ownCol` is the entity's own
// tenant column. `alias`/`startIndex` place it in the caller's query. Wired for
// Phase 2.
export function coverageChainClause(
  actor: CoverageActor,
  opts: { alias?: string; memberCol?: string; ownCol?: string; startIndex?: number } = {},
): { sql: string; params: unknown[] } {
  const alias = opts.alias ?? 'm';
  const memberCol = opts.memberCol ?? 'id';
  const ownCol = opts.ownCol ?? 'org_id';
  const startIndex = opts.startIndex ?? 1;
  const pre = alias ? `${alias}.` : ''; // empty alias → unqualified columns

  const scope = memberAccessScope(actor.orgType, actor.isPlatform);
  if (scope === 'all') return { sql: 'TRUE', params: [] };

  const p = `$${startIndex}`;
  const own = `${pre}${ownCol} = ${p}`;

  if (scope === 'offered-plans' || scope === 'underwritten-plans') {
    const planCol = scope === 'offered-plans' ? 'offered_by_org_id' : 'underwriter_org_id';
    // Distinctive inner aliases (cc_e / cc_pl) so this never collides with an outer
    // query that already aliases enrolments/insurance_plans (e.g. the dashboard).
    return {
      sql: `(${own} OR ${pre}${memberCol} IN (
        SELECT cc_e.member_id FROM enrolments cc_e
          JOIN insurance_plans cc_pl ON cc_pl.id = cc_e.plan_id
         WHERE cc_pl.${planCol} = ${p}))`,
      params: [actor.orgId],
    };
  }
  return { sql: own, params: [actor.orgId] };
}

// Scope a members query (members-table alias, keyed on m.id).
export function memberVisibilityClause(
  actor: CoverageActor,
  alias = 'm',
  startIndex = 1,
): { sql: string; params: unknown[] } {
  return coverageChainClause(actor, { alias, memberCol: 'id', startIndex });
}

// Resolve the calling org's context (type + platform flag) for the clause builders.
export async function resolveOrgActor(orgId: string): Promise<CoverageActor> {
  const r = await query('SELECT type, is_platform FROM organisations WHERE id = $1', [orgId]);
  return { orgId, orgType: r.rows[0]?.type ?? null, isPlatform: Boolean(r.rows[0]?.is_platform) };
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
