// Single source of truth for organisation types and their "class".
//
//   demand      — owns its own members (the paying/enrolling customers)
//   supply      — delivers care to OTHER orgs' members (sees only routed work)
//   integration — rails / infrastructure partners
//   platform    — MobiCova itself
//
// Data isolation is enforced everywhere by org_id-scoped queries regardless of
// class; `class` drives which workspaces/capabilities an org's admins get.

export type OrgClass = 'demand' | 'supply' | 'integration' | 'platform';

export interface OrgTypeMeta {
  label: string;
  class: OrgClass;
  ownsMembers: boolean;
}

export const ORG_TYPE_META: Record<string, OrgTypeMeta> = {
  company: { label: 'Company / Employer', class: 'demand', ownsMembers: true },
  underwriter: { label: 'Insurance company (underwriter)', class: 'demand', ownsMembers: true },
  hmo: { label: 'HMO', class: 'demand', ownsMembers: true },
  telco: { label: 'Telco', class: 'demand', ownsMembers: true },
  fintech: { label: 'Fintech', class: 'demand', ownsMembers: true },
  cooperative: { label: 'Cooperative', class: 'demand', ownsMembers: true },
  clinic: { label: 'Clinic / Doctors', class: 'supply', ownsMembers: false },
  pharmacy: { label: 'Pharmacy', class: 'supply', ownsMembers: false },
  diagnostics: { label: 'Diagnostics', class: 'supply', ownsMembers: false },
  ehr: { label: 'EHR / Health IT', class: 'integration', ownsMembers: false },
  distribution: { label: 'Distribution', class: 'integration', ownsMembers: false },
};

export function orgClass(type: string | null | undefined): OrgClass {
  return ORG_TYPE_META[String(type)]?.class ?? 'demand';
}

export function orgTypeLabel(type: string | null | undefined): string {
  return ORG_TYPE_META[String(type)]?.label ?? String(type ?? '');
}

export function isSupplyType(type: string | null | undefined): boolean {
  return orgClass(type) === 'supply';
}
