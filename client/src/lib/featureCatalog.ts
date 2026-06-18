// Shared catalogue of features prospects can express interest in and rank.
// Used by the public "Help shape MobiCova" page and the admin results view.

export type Feature = { key: string; label: string; hint?: string };
export type FeatureGroup = { group: string; features: Feature[] };

export const FEATURE_CATALOG: FeatureGroup[] = [
  {
    group: 'AI health buddies',
    features: [
      { key: 'buddy_general', label: 'General health chat buddy', hint: 'Free, friendly basic health tips' },
      { key: 'buddy_safe_emotions', label: 'Safe Emotions companion', hint: 'Emotional wellbeing & support' },
      { key: 'buddy_mental_health', label: 'Mental health' },
      { key: 'buddy_menstrual', label: 'Menstrual / period tracker' },
      { key: 'buddy_gynaecology', label: 'Gynaecology' },
      { key: 'buddy_psychiatry', label: 'Psychiatry' },
      { key: 'buddy_paediatrics', label: 'Paediatrics' },
      { key: 'buddy_dietetics', label: 'Dietetics & nutrition' },
      { key: 'buddy_general_consult', label: 'General consultation' },
    ],
  },
  {
    group: 'Care & platform',
    features: [
      { key: 'telemedicine', label: 'Doctor consultations (telemedicine)' },
      { key: 'insurance', label: 'Health insurance / cover' },
      { key: 'claims', label: 'Claims' },
      { key: 'pharmacy', label: 'Pharmacy & medication delivery' },
      { key: 'symptom_checker', label: 'AI symptom checker / triage' },
      { key: 'channels', label: 'Access via WhatsApp & USSD' },
    ],
  },
];

export const FEATURE_LABELS: Record<string, string> = Object.fromEntries(
  FEATURE_CATALOG.flatMap((g) => g.features.map((f) => [f.key, f.label]))
);

export function featureLabel(key: string): string {
  return FEATURE_LABELS[key] || key;
}
