// Effective premium for an enrolment = the employer's negotiated rate for the plan
// (plan_assignments), falling back to the plan's list monthly_premium. Retail
// members (no employer assignment) use the list price. Use these fragments wherever
// premium is AGGREGATED so negotiated group pricing is reflected consistently.
//
// Assumes the query aliases insurance_plans as `pl` and joins via planAssignmentJoin
// (which aliases plan_assignments as `pa`).

export const EFFECTIVE_PREMIUM = 'COALESCE(pa.negotiated_premium, pl.monthly_premium)';

// LEFT JOIN attaching the active plan_assignment for each enrolment. `enrol` is the
// enrolments alias in the caller's query (e / en). plan_assignments is UNIQUE per
// (employer_org_id, plan_id), so this never multiplies rows.
export function planAssignmentJoin(enrol: string): string {
  return `LEFT JOIN plan_assignments pa
            ON pa.employer_org_id = ${enrol}.org_id
           AND pa.plan_id = ${enrol}.plan_id
           AND pa.status = 'active'`;
}
