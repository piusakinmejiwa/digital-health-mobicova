// Client mirror of the server's organisation-type metadata (server/src/lib/orgTypes.ts).
// Keep the two in sync.

export type OrgClass = 'demand' | 'supply' | 'integration' | 'platform';

export interface OrgTypeMeta {
  label: string;
  class: OrgClass;
}

export const ORG_TYPE_META: Record<string, OrgTypeMeta> = {
  company: { label: 'Company / Employer', class: 'demand' },
  underwriter: { label: 'Underwriter', class: 'demand' },
  telco: { label: 'Telco', class: 'demand' },
  fintech: { label: 'Fintech', class: 'demand' },
  cooperative: { label: 'Cooperative', class: 'demand' },
  clinic: { label: 'Clinic / Doctors', class: 'supply' },
  pharmacy: { label: 'Pharmacy', class: 'supply' },
  diagnostics: { label: 'Diagnostics', class: 'supply' },
  ehr: { label: 'EHR / Health IT', class: 'integration' },
  distribution: { label: 'Distribution', class: 'integration' },
};

// Display order for dropdowns/filters (grouped by class).
export const ORG_TYPES = Object.keys(ORG_TYPE_META);

export function orgTypeLabel(type: string): string {
  return ORG_TYPE_META[type]?.label ?? type;
}

export function orgClassOf(type: string): OrgClass {
  return ORG_TYPE_META[type]?.class ?? 'demand';
}

// Badge colour per class (reuses the global badge-* classes).
export function orgClassBadge(type: string): string {
  switch (orgClassOf(type)) {
    case 'supply': return 'badge-green';
    case 'integration': return 'badge-gray';
    default: return 'badge-blue'; // demand
  }
}
