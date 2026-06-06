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
