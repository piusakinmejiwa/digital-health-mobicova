// Member-care privacy "slice" for SUPPLY-side organisations.
//
// A clinic/pharmacy serves members that belong to OTHER organisations, so it
// must only ever read the minimum needed to deliver care — proven by a routing
// link (provider_org_id / pharmacy_org_id). These SELECT fragments are the
// single place that boundary is defined; supply-org queries must use them rather
// than `m.*`.

// A CLINIC (for a consult routed to it) may see clinically-necessary context.
export const CLINIC_MEMBER_FIELDS = `
  m.full_name AS member_name, m.gender, m.date_of_birth,
  m.allergies, m.chronic_conditions, m.current_medications, m.blood_group
`;

// A PHARMACY (for a prescription routed to it) may see name + delivery details
// (the medication/address live on the prescription row itself).
export const PHARMACY_MEMBER_FIELDS = `
  m.full_name AS member_name, m.phone AS member_phone
`;

// DEMAND-side gating: an owning org's OWN admins viewing their OWN members.
// Employers (company/telco/fintech/cooperative) administer membership but must
// not see clinical PHI — conditions, DOB, phone — anywhere. HMOs/underwriters
// (who carry the clinical risk) and platform admins may, inside the member
// PROFILE only; the member LIST never carries PHI for anyone.
const PHI_OWNER_TYPES = new Set(['underwriter']);

export function ownerCanViewPhi(
  orgType: string | null | undefined,
  isPlatformAdmin: boolean,
): boolean {
  return isPlatformAdmin || PHI_OWNER_TYPES.has(String(orgType));
}

// Member-row fields removed from a profile when the viewer can't see PHI.
export const PHI_MEMBER_FIELDS = [
  'date_of_birth', 'phone', 'chronic_conditions',
  'allergies', 'current_medications', 'blood_group',
] as const;

// Consultation fields removed when the viewer can't see PHI (these carry the
// clinical picture). Utilisation context — dates, mode, status — is retained.
const PHI_CONSULT_FIELDS = ['reason', 'notes', 'diagnosis'] as const;

// Strip a member row + its related records to the non-clinical subset.
export function redactMemberPhi<T extends Record<string, unknown>>(member: T): T {
  const out = { ...member };
  for (const f of PHI_MEMBER_FIELDS) delete (out as Record<string, unknown>)[f];
  return out;
}

export function redactConsultationsPhi(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((r) => {
    const out = { ...r };
    for (const f of PHI_CONSULT_FIELDS) delete out[f];
    return out;
  });
}
