// Claim status + type vocabulary and the adjudication state machine, shared by
// the controller (validation) and exposed to the client for labels/filters.

export const CLAIM_STATUSES = ['submitted', 'under_review', 'approved', 'rejected', 'paid'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const CLAIM_TYPES = [
  'outpatient', 'inpatient', 'pharmacy', 'dental', 'optical',
  'maternity', 'emergency', 'diagnostics', 'other',
] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

// Allowed adjudication transitions. A claim is submitted, optionally moved into
// review, then approved or rejected; an approved claim can be marked paid (or
// rejected on a late finding). Rejected and paid are terminal.
const TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  submitted: ['under_review', 'approved', 'rejected'],
  under_review: ['approved', 'rejected'],
  approved: ['paid', 'rejected'],
  rejected: [],
  paid: [],
};

export function isClaimStatus(value: unknown): value is ClaimStatus {
  return typeof value === 'string' && (CLAIM_STATUSES as readonly string[]).includes(value);
}

export function isClaimType(value: unknown): value is ClaimType {
  return typeof value === 'string' && (CLAIM_TYPES as readonly string[]).includes(value);
}

export function canTransition(from: string, to: string): boolean {
  return isClaimStatus(from) && isClaimStatus(to) && TRANSITIONS[from].includes(to);
}

// Human-readable claim reference, e.g. CLM-K3X9Q2. The UNIQUE constraint on
// claims.reference is the real collision guard; this just keeps codes short and
// unguessable enough for support conversations.
export function generateClaimReference(): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const tail = Date.now().toString(36).slice(-2).toUpperCase();
  return `CLM-${tail}${rand}`;
}
