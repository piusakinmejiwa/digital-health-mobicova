import { useEffect, useState } from 'react';
import axios from 'axios';
import { adminGetOrgOnboarding, adminSaveOrgOnboarding } from '../../api/admin';
import type { Organisation } from '../../types';
import './OrgOnboarding.css';

/* eslint-disable @typescript-eslint/no-explicit-any */
// A step-by-step onboarding questionnaire for an organisation (8 sections from
// the partner intake spec). Field definitions are data-driven so the whole form
// renders from one generic renderer; values are stored as a flexible JSONB
// profile (data[sectionKey][fieldKey]), with headline fields mirrored to the
// org row server-side. Document upload is a later phase — here we capture which
// documents the org has ready.

type FieldType =
  | 'text' | 'textarea' | 'number' | 'tel' | 'email' | 'url'
  | 'select' | 'yesno' | 'multiselect' | 'branches' | 'agreement';

interface Field {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  placeholder?: string;
  help?: string;
  showIf?: (s: any) => boolean;
}
interface Section { key: string; title: string; intro?: string; fields: Field[]; }

const SIZE = ['Micro (1–9)', 'Small (10–49)', 'Medium (50–249)', 'Large (250+)'];

const EMPLOYER_SECTIONS: Section[] = [
  {
    key: 'identity', title: 'Company identity & verification',
    intro: 'Confirm who the organisation is and who is authorised to act for them.',
    fields: [
      { key: 'registeredName', label: 'Registered company name', type: 'text' },
      { key: 'tradingName', label: 'Trading name (if different)', type: 'text' },
      { key: 'rcNumber', label: 'RC number (CAC)', type: 'text' },
      { key: 'tin', label: 'Tax Identification Number (TIN)', type: 'text' },
      { key: 'industry', label: 'Industry / sector', type: 'text' },
      { key: 'companySize', label: 'Company size', type: 'select', options: SIZE },
      { key: 'address', label: 'Physical address', type: 'textarea', placeholder: 'Street, area' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'state', label: 'State', type: 'text' },
      { key: 'postalCode', label: 'Postal code', type: 'text' },
      { key: 'website', label: 'Website', type: 'url', placeholder: 'https://' },
      { key: 'contactName', label: 'Contact person — name', type: 'text' },
      { key: 'contactRole', label: 'Contact person — role', type: 'text' },
      { key: 'contactPhone', label: 'Contact person — phone', type: 'tel' },
      { key: 'contactEmail', label: 'Contact person — email', type: 'email' },
      { key: 'secondaryContact', label: 'Secondary contact (optional)', type: 'text' },
      { key: 'hasExistingHmo', label: 'Existing HMO or insurance partner?', type: 'yesno' },
      { key: 'existingHmoName', label: 'Partner name and plan type', type: 'text', showIf: (s) => s.hasExistingHmo === true },
    ],
  },
  {
    key: 'workforce', title: 'Workforce structure',
    intro: 'How members will be grouped, billed and managed.',
    fields: [
      { key: 'totalEmployees', label: 'Total number of employees', type: 'number' },
      { key: 'fullTime', label: 'Number of full-time staff', type: 'number' },
      { key: 'contractStaff', label: 'Number of contract / temporary staff', type: 'number' },
      { key: 'includeDependents', label: 'Include dependents?', type: 'yesno' },
      { key: 'dependentsEstimate', label: 'Expected total number of dependents', type: 'number', showIf: (s) => s.includeDependents === true },
      { key: 'multipleBranches', label: 'Multiple branches?', type: 'yesno' },
      { key: 'branches', label: 'Branches (name + staff count)', type: 'branches', showIf: (s) => s.multipleBranches === true },
      { key: 'branchAdminAccess', label: 'Want branch-level admin access?', type: 'yesno' },
    ],
  },
  {
    key: 'eligibility', title: 'Eligibility & enrollment rules',
    intro: 'How onboarding is automated.',
    fields: [
      { key: 'eligible', label: 'Who is eligible for coverage?', type: 'multiselect', options: ['All staff', 'Full-time only', 'Contract staff', 'Staff + dependents'] },
      { key: 'probation', label: 'Probation period before eligibility?', type: 'yesno' },
      { key: 'probationDays', label: 'Probation period (days)', type: 'number', showIf: (s) => s.probation === true },
      { key: 'idVerification', label: 'Require ID verification for each member?', type: 'yesno' },
      { key: 'idTypes', label: 'Accepted ID types', type: 'multiselect', options: ['NIN', 'BVN', 'Work ID', "Voter's card", 'International passport'], showIf: (s) => s.idVerification === true },
    ],
  },
  {
    key: 'plans', title: 'Plan selection & benefits',
    fields: [
      { key: 'plans', label: 'Which plan(s) are you interested in?', type: 'multiselect', options: ['Health cover', 'Micro-insurance', 'Telemedicine', 'Wellness & preventive care', 'Hospital network access'] },
      { key: 'planStructure', label: 'Single plan for all staff, or tiered?', type: 'select', options: ['Single plan for all staff', 'Tiered plans'] },
      { key: 'tiers', label: 'List tiers (e.g. Basic, Standard, Executive)', type: 'text', showIf: (s) => s.planStructure === 'Tiered plans' },
      { key: 'addons', label: 'Add-ons', type: 'multiselect', options: ['Maternity', 'Dental', 'Optical', 'Pharmacy benefits', 'Chronic care'] },
      { key: 'customBenefits', label: 'Require custom benefits?', type: 'yesno' },
      { key: 'customBenefitsDetail', label: 'Describe the custom benefits', type: 'textarea', showIf: (s) => s.customBenefits === true },
    ],
  },
  {
    key: 'billing', title: 'Billing & payment preferences',
    fields: [
      { key: 'billingCycle', label: 'Preferred billing cycle', type: 'select', options: ['Monthly', 'Quarterly', 'Annual'] },
      { key: 'paymentMethod', label: 'Payment method', type: 'select', options: ['Bank transfer', 'Direct debit', 'Wallet funding'] },
      { key: 'invoiceName', label: 'Invoices to — name', type: 'text' },
      { key: 'invoiceEmail', label: 'Invoices to — email', type: 'email' },
      { key: 'splitBilling', label: 'Split billing (company + employee contribution)?', type: 'yesno' },
      { key: 'splitPercent', label: 'Percentage split (e.g. 70/30)', type: 'text', showIf: (s) => s.splitBilling === true },
      { key: 'autoReminders', label: 'Automated payment reminders?', type: 'yesno' },
    ],
  },
  {
    key: 'integration', title: 'Data & integration requirements',
    fields: [
      { key: 'memberDataMethod', label: 'How will member data be provided?', type: 'select', options: ['Excel upload', 'API integration', 'Manual entry'] },
      { key: 'hrIntegration', label: 'Integrate with HR / payroll system?', type: 'yesno' },
      { key: 'hrSystem', label: 'Which HR / payroll system?', type: 'text', showIf: (s) => s.hrIntegration === true },
      { key: 'sso', label: 'Require SSO for staff?', type: 'yesno' },
      { key: 'auditLogs', label: 'Require audit logs for compliance?', type: 'yesno' },
    ],
  },
  {
    key: 'claims', title: 'Claims & support expectations',
    fields: [
      { key: 'claimApprover', label: 'Who approves claims internally?', type: 'text' },
      { key: 'realtimeClaims', label: 'Real-time claim notifications?', type: 'yesno' },
      { key: 'commChannel', label: 'Preferred communication channel', type: 'select', options: ['Email', 'SMS', 'WhatsApp'] },
      { key: 'dedicatedAm', label: 'Require a dedicated account manager?', type: 'yesno' },
      { key: 'utilisationReports', label: 'Utilisation reports', type: 'select', options: ['Monthly', 'Quarterly'] },
    ],
  },
  {
    key: 'compliance', title: 'Compliance & agreements',
    intro: 'Confirmed before activation. Document upload comes in a later step — for now, tell us which you have ready.',
    fields: [
      { key: 'agreeDataProtection', label: 'Agree to MobiCova’s data protection policy', type: 'agreement' },
      { key: 'agreeSla', label: 'Agree to the service-level agreement (SLA)', type: 'agreement' },
      { key: 'agreeBilling', label: 'Agree to the billing and refund policy', type: 'agreement' },
      { key: 'requireContract', label: 'Require a signed contract?', type: 'yesno' },
      { key: 'documentsReady', label: 'Documents ready to provide', type: 'multiselect', options: ['CAC certificate', 'Tax certificate', 'Staff list', 'Company ID template'] },
    ],
  },
];

// Insurer / underwriter / HMO onboarding — a different shape from an employer:
// licensing, products underwritten, the policyholder book, claims & settlement,
// provider network, commercials. The identity keys are kept the same as the
// employer set (registeredName, rcNumber, tin, contact*, address…) so the same
// headline fields mirror onto the org row server-side.
const INSURER_SECTIONS: Section[] = [
  {
    key: 'identity', title: 'Insurer identity & licensing',
    intro: 'Confirm the underwriter’s legal identity and regulatory standing.',
    fields: [
      { key: 'registeredName', label: 'Registered company name', type: 'text' },
      { key: 'tradingName', label: 'Trading name (if different)', type: 'text' },
      { key: 'rcNumber', label: 'RC number (CAC)', type: 'text' },
      { key: 'naicomLicence', label: 'NAICOM / regulator licence number', type: 'text' },
      { key: 'licenceType', label: 'Licence type', type: 'select', options: ['Health / HMO', 'Life', 'General', 'Composite', 'Micro-insurance'] },
      { key: 'tin', label: 'Tax Identification Number (TIN)', type: 'text' },
      { key: 'yearEstablished', label: 'Year established', type: 'number' },
      { key: 'website', label: 'Website', type: 'url', placeholder: 'https://' },
      { key: 'address', label: 'Head office address', type: 'textarea' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'state', label: 'State', type: 'text' },
      { key: 'contactName', label: 'Primary contact — name', type: 'text' },
      { key: 'contactRole', label: 'Primary contact — role', type: 'text' },
      { key: 'contactPhone', label: 'Primary contact — phone', type: 'tel' },
      { key: 'contactEmail', label: 'Primary contact — email', type: 'email' },
    ],
  },
  {
    key: 'products', title: 'Products & benefits underwritten',
    fields: [
      { key: 'productLines', label: 'Product lines', type: 'multiselect', options: ['HMO / managed care', 'Group health', 'Individual health', 'Micro-insurance', 'Hospital cash', 'Critical illness', 'Life'] },
      { key: 'planTiers', label: 'Plan tiers (e.g. Bronze, Silver, Gold)', type: 'text' },
      { key: 'benefitsCovered', label: 'Benefits covered', type: 'multiselect', options: ['Outpatient', 'Inpatient', 'Maternity', 'Dental', 'Optical', 'Pharmacy', 'Chronic care', 'Emergency', 'Diagnostics', 'Telemedicine'] },
      { key: 'annualLimits', label: 'Typical annual limit range', type: 'text', placeholder: 'e.g. ₦250k – ₦5m' },
      { key: 'waitingPeriods', label: 'Any waiting periods?', type: 'yesno' },
      { key: 'waitingPeriodDetail', label: 'Waiting period details', type: 'text', showIf: (s) => s.waitingPeriods === true },
    ],
  },
  {
    key: 'membership', title: 'Policyholder book',
    intro: 'How many members, and how their data reaches us.',
    fields: [
      { key: 'totalPolicyholders', label: 'Total policyholders', type: 'number' },
      { key: 'expectedMembersOnPlatform', label: 'Expected members on MobiCova', type: 'number' },
      { key: 'memberSegments', label: 'Member segments', type: 'multiselect', options: ['Retail / individual', 'Corporate / group', 'SME', 'Family / dependents'] },
      { key: 'coversDependents', label: 'Cover includes dependents?', type: 'yesno' },
      { key: 'dataProvisionMethod', label: 'How will member data be provided?', type: 'select', options: ['Excel upload', 'API integration', 'Manual entry'] },
    ],
  },
  {
    key: 'claims', title: 'Claims & settlement',
    fields: [
      { key: 'claimsHandling', label: 'Claims handling', type: 'select', options: ['In-house', 'Third-party administrator (TPA)', 'Hybrid'] },
      { key: 'tpaName', label: 'TPA name', type: 'text', showIf: (s) => s.claimsHandling && s.claimsHandling !== 'In-house' },
      { key: 'preAuthRequired', label: 'Pre-authorisation required?', type: 'yesno' },
      { key: 'claimsApprover', label: 'Who approves claims?', type: 'text' },
      { key: 'settlementCadence', label: 'Settlement cadence', type: 'select', options: ['Weekly', 'Bi-weekly', 'Monthly'] },
      { key: 'avgSettlementDays', label: 'Average settlement time (days)', type: 'number' },
      { key: 'realTimeClaims', label: 'Want real-time claim notifications?', type: 'yesno' },
    ],
  },
  {
    key: 'network', title: 'Provider network & fulfilment',
    fields: [
      { key: 'ownNetwork', label: 'Do you have your own provider network?', type: 'yesno' },
      { key: 'networkSize', label: 'Number of network providers', type: 'number', showIf: (s) => s.ownNetwork === true },
      { key: 'useMobicovaNetwork', label: 'Use MobiCova’s provider network?', type: 'yesno' },
      { key: 'telemedicine', label: 'Offer telemedicine to members?', type: 'yesno' },
      { key: 'pharmacyFulfilment', label: 'Pharmacy fulfilment', type: 'select', options: ['Own pharmacies', 'PharmaRun', 'Either'] },
    ],
  },
  {
    key: 'billing', title: 'Commercials & billing',
    fields: [
      { key: 'commercialModel', label: 'Commercial model', type: 'select', options: ['Per member per month (PMPM)', 'Revenue share', 'Flat platform fee', 'Per transaction'] },
      { key: 'billingCycle', label: 'Billing cycle', type: 'select', options: ['Monthly', 'Quarterly', 'Annual'] },
      { key: 'invoiceName', label: 'Invoices to — name', type: 'text' },
      { key: 'invoiceEmail', label: 'Invoices to — email', type: 'email' },
      { key: 'paymentMethod', label: 'Payment method', type: 'select', options: ['Bank transfer', 'Direct debit', 'Wallet funding'] },
    ],
  },
  {
    key: 'compliance', title: 'Compliance & agreements',
    intro: 'Confirmed before activation. Upload documents from the “Members & docs” area.',
    fields: [
      { key: 'ndprRegistered', label: 'Registered with NDPC (NDPR)?', type: 'yesno' },
      { key: 'dpoName', label: 'Data Protection Officer (name)', type: 'text' },
      { key: 'requireDpa', label: 'Require a signed Data Processing Agreement?', type: 'yesno' },
      { key: 'agreeDataProtection', label: 'Agree to MobiCova’s data protection policy', type: 'agreement' },
      { key: 'agreeSla', label: 'Agree to the service-level agreement (SLA)', type: 'agreement' },
      { key: 'agreeBilling', label: 'Agree to the billing and settlement terms', type: 'agreement' },
      { key: 'documentsReady', label: 'Documents ready to provide', type: 'multiselect', options: ['NAICOM licence', 'CAC certificate', 'Tax certificate', 'DPA template', 'Product brochure'] },
    ],
  },
];

// Clinic / hospital onboarding — a SUPPLY-side facility that provides the
// doctors and care: facility licensing, services, clinical staffing, operating
// model. Identity keys stay shared so headline fields mirror onto the org row.
const CLINIC_SECTIONS: Section[] = [
  {
    key: 'identity', title: 'Facility identity & licensing',
    intro: 'Confirm the facility’s legal identity and that it is licensed to operate.',
    fields: [
      { key: 'registeredName', label: 'Registered facility name', type: 'text' },
      { key: 'tradingName', label: 'Trading / brand name (if different)', type: 'text' },
      { key: 'rcNumber', label: 'RC number (CAC)', type: 'text' },
      { key: 'facilityLicenceNo', label: 'Facility licence no. (HEFAMAA / State MoH)', type: 'text' },
      { key: 'facilityType', label: 'Facility type', type: 'select', options: ['Primary care clinic', 'General hospital', 'Specialist clinic', 'Diagnostic + clinic', 'Telemedicine-only'] },
      { key: 'tin', label: 'Tax Identification Number (TIN)', type: 'text' },
      { key: 'yearEstablished', label: 'Year established', type: 'number' },
      { key: 'website', label: 'Website', type: 'url', placeholder: 'https://' },
      { key: 'address', label: 'Facility address', type: 'textarea' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'state', label: 'State', type: 'text' },
      { key: 'contactName', label: 'Primary contact — name', type: 'text' },
      { key: 'contactRole', label: 'Primary contact — role', type: 'text' },
      { key: 'contactPhone', label: 'Primary contact — phone', type: 'tel' },
      { key: 'contactEmail', label: 'Primary contact — email', type: 'email' },
    ],
  },
  {
    key: 'services', title: 'Services & specialties',
    fields: [
      { key: 'services', label: 'Services offered', type: 'multiselect', options: ['General / Family medicine', 'Paediatrics', 'Obstetrics & gynaecology', 'Internal medicine', 'Surgery', 'Dental', 'Optical', 'Mental health', 'Antenatal', 'Vaccinations', 'Minor procedures', 'Emergency'] },
      { key: 'specialties', label: 'Other specialties (free text)', type: 'text' },
      { key: 'telemedicine', label: 'Offer telemedicine consults via MobiCova?', type: 'yesno' },
      { key: 'homeVisits', label: 'Offer home visits?', type: 'yesno' },
      { key: 'languages', label: 'Languages spoken', type: 'multiselect', options: ['English', 'Pidgin', 'Hausa', 'Yoruba', 'Igbo'] },
    ],
  },
  {
    key: 'staffing', title: 'Clinical staffing & capacity',
    fields: [
      { key: 'numDoctors', label: 'Number of doctors', type: 'number' },
      { key: 'numNurses', label: 'Number of nurses', type: 'number' },
      { key: 'mdcnVerified', label: 'All doctors MDCN-registered & current?', type: 'yesno' },
      { key: 'consultCapacityPerDay', label: 'Consultation capacity per day', type: 'number' },
      { key: 'bedsAvailable', label: 'Beds available (if any)', type: 'number' },
      { key: 'acceptsReferrals', label: 'Accept referrals from other providers?', type: 'yesno' },
    ],
  },
  {
    key: 'operations', title: 'Operations & availability',
    fields: [
      { key: 'operatingHours', label: 'Operating hours', type: 'text', placeholder: 'e.g. Mon–Fri 8am–6pm, Sat 9am–2pm' },
      { key: 'open247', label: 'Open 24/7?', type: 'yesno' },
      { key: 'consultModes', label: 'Consultation modes', type: 'multiselect', options: ['In-person', 'Video', 'Voice', 'Chat'] },
      { key: 'multipleBranches', label: 'Multiple branches?', type: 'yesno' },
      { key: 'branches', label: 'Branches (name + staff count)', type: 'branches', showIf: (s) => s.multipleBranches === true },
      { key: 'avgWaitTime', label: 'Typical wait time', type: 'text', placeholder: 'e.g. under 30 min' },
    ],
  },
  {
    key: 'integration', title: 'Integration & data',
    fields: [
      { key: 'ehrSystem', label: 'EHR / clinic-management software used', type: 'text' },
      { key: 'ehrIntegration', label: 'Integrate your EHR with MobiCova?', type: 'yesno' },
      { key: 'providerDataMethod', label: 'How will doctors be added?', type: 'select', options: ['We add them in the MobiCova provider portal', 'Excel upload', 'API integration'] },
      { key: 'settlementAccountReady', label: 'Settlement bank account ready?', type: 'yesno' },
    ],
  },
  {
    key: 'commercials', title: 'Commercials & settlement',
    fields: [
      { key: 'pricingModel', label: 'Pricing model', type: 'select', options: ['Fee-for-service', 'Capitation', 'Per consultation', 'Negotiated tariff'] },
      { key: 'consultFeeRange', label: 'Typical consultation fee range', type: 'text', placeholder: 'e.g. ₦5,000 – ₦15,000' },
      { key: 'settlementCadence', label: 'Settlement cadence', type: 'select', options: ['Weekly', 'Bi-weekly', 'Monthly'] },
      { key: 'invoiceName', label: 'Remittance / invoices to — name', type: 'text' },
      { key: 'invoiceEmail', label: 'Remittance / invoices to — email', type: 'email' },
      { key: 'paymentMethod', label: 'Payment method', type: 'select', options: ['Bank transfer', 'Direct debit', 'Wallet funding'] },
    ],
  },
  {
    key: 'compliance', title: 'Compliance & agreements',
    intro: 'Confirmed before activation. Upload documents from the “Members & docs” area.',
    fields: [
      { key: 'facilityLicenceValid', label: 'Facility operating licence current & valid?', type: 'yesno' },
      { key: 'indemnityInsurance', label: 'Professional indemnity insurance in place?', type: 'yesno' },
      { key: 'ndprAware', label: 'Aware of NDPR / patient-data obligations?', type: 'yesno' },
      { key: 'agreeDataProtection', label: 'Agree to MobiCova’s data protection policy', type: 'agreement' },
      { key: 'agreeSla', label: 'Agree to the service-level agreement (SLA)', type: 'agreement' },
      { key: 'agreeClinicalGovernance', label: 'Agree to MobiCova’s clinical governance standards', type: 'agreement' },
      { key: 'requireContract', label: 'Require a signed contract?', type: 'yesno' },
      { key: 'documentsReady', label: 'Documents ready to provide', type: 'multiselect', options: ['Facility licence', 'CAC certificate', 'MDCN certificates', 'Indemnity insurance', 'Tax certificate', 'Price list'] },
    ],
  },
];

// Pharmacy onboarding — SUPPLY-side dispensing partner. Generic enough for both
// an aggregator/network (PharmaRun, our first partner) and individual pharmacies
// onboarded later: PCN licensing, dispensing, coverage, fulfilment/delivery,
// integration (how e-prescriptions are received), commercials.
const PHARMACY_SECTIONS: Section[] = [
  {
    key: 'identity', title: 'Pharmacy identity & licensing',
    intro: 'Confirm the pharmacy’s legal identity and PCN registration.',
    fields: [
      { key: 'registeredName', label: 'Registered pharmacy name', type: 'text' },
      { key: 'tradingName', label: 'Trading / brand name (if different)', type: 'text' },
      { key: 'rcNumber', label: 'RC number (CAC)', type: 'text' },
      { key: 'pcnPremisesLicence', label: 'PCN premises registration number', type: 'text' },
      { key: 'superintendentPharmacist', label: 'Superintendent pharmacist (name)', type: 'text' },
      { key: 'superintendentPcnNo', label: 'Superintendent PCN registration no.', type: 'text' },
      { key: 'pharmacyType', label: 'Pharmacy type', type: 'select', options: ['Community / retail', 'Hospital pharmacy', 'Online / e-pharmacy', 'Distribution / wholesale', 'Network / aggregator'] },
      { key: 'tin', label: 'Tax Identification Number (TIN)', type: 'text' },
      { key: 'website', label: 'Website', type: 'url', placeholder: 'https://' },
      { key: 'address', label: 'Premises address', type: 'textarea' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'state', label: 'State', type: 'text' },
      { key: 'contactName', label: 'Primary contact — name', type: 'text' },
      { key: 'contactRole', label: 'Primary contact — role', type: 'text' },
      { key: 'contactPhone', label: 'Primary contact — phone', type: 'tel' },
      { key: 'contactEmail', label: 'Primary contact — email', type: 'email' },
    ],
  },
  {
    key: 'dispensing', title: 'Dispensing & services',
    fields: [
      { key: 'services', label: 'Services offered', type: 'multiselect', options: ['Prescription dispensing', 'OTC medicines', 'Chronic / refill programmes', 'Vaccinations', 'Health screening (BP/sugar)', 'Medicine counselling', 'Compounding', 'Medical consumables'] },
      { key: 'controlledDrugs', label: 'Handle controlled / scheduled medicines?', type: 'yesno' },
      { key: 'coldChain', label: 'Cold-chain storage (vaccines, insulin)?', type: 'yesno' },
      { key: 'substitution', label: 'Offer generic substitution?', type: 'yesno' },
      { key: 'formularyBreadth', label: 'Typical formulary breadth / key brands', type: 'text' },
    ],
  },
  {
    key: 'coverage', title: 'Coverage & locations',
    fields: [
      { key: 'isAggregator', label: 'Are you a pharmacy network / aggregator?', type: 'yesno', help: 'PharmaRun = yes' },
      { key: 'numOutlets', label: 'Number of outlets / branches', type: 'number' },
      { key: 'coverageAreas', label: 'States / cities covered', type: 'text' },
      { key: 'nearestOutletRouting', label: 'Can route an order to the nearest outlet to the patient?', type: 'yesno' },
      { key: 'multipleBranches', label: 'List individual branches?', type: 'yesno' },
      { key: 'branches', label: 'Branches (name + staff count)', type: 'branches', showIf: (s) => s.multipleBranches === true },
    ],
  },
  {
    key: 'fulfilment', title: 'Fulfilment & delivery',
    fields: [
      { key: 'fulfilmentModes', label: 'Fulfilment modes', type: 'multiselect', options: ['Pickup', 'Delivery', 'Both'] },
      { key: 'deliveryCoverage', label: 'Delivery coverage (radius / areas)', type: 'text' },
      { key: 'deliverySla', label: 'Typical delivery time', type: 'text', placeholder: 'e.g. same day, under 2 hours' },
      { key: 'ownRiders', label: 'Own delivery fleet / riders?', type: 'yesno' },
      { key: 'tracking', label: 'Provide delivery tracking to the member?', type: 'yesno' },
    ],
  },
  {
    key: 'integration', title: 'Integration & data',
    intro: 'How e-prescriptions reach the pharmacy.',
    fields: [
      { key: 'prescriptionChannel', label: 'How are e-prescriptions received?', type: 'select', options: ['PharmaRun network', 'Direct API to MobiCova', 'Pharmacy portal (manual)', 'Other'] },
      { key: 'pharmacySystem', label: 'POS / inventory software used', type: 'text' },
      { key: 'inventoryIntegration', label: 'Real-time stock-availability integration?', type: 'yesno' },
      { key: 'apiAvailable', label: 'Do you have an API we can integrate?', type: 'yesno' },
      { key: 'settlementAccountReady', label: 'Settlement bank account ready?', type: 'yesno' },
    ],
  },
  {
    key: 'commercials', title: 'Commercials & settlement',
    fields: [
      { key: 'pricingModel', label: 'Pricing model', type: 'select', options: ['Cost-plus margin', 'Fixed dispensing fee', 'Negotiated tariff', 'Per order'] },
      { key: 'dispensingFee', label: 'Dispensing / service fee', type: 'text' },
      { key: 'settlementCadence', label: 'Settlement cadence', type: 'select', options: ['Weekly', 'Bi-weekly', 'Monthly'] },
      { key: 'invoiceName', label: 'Remittance / invoices to — name', type: 'text' },
      { key: 'invoiceEmail', label: 'Remittance / invoices to — email', type: 'email' },
      { key: 'paymentMethod', label: 'Payment method', type: 'select', options: ['Bank transfer', 'Direct debit', 'Wallet funding'] },
    ],
  },
  {
    key: 'compliance', title: 'Compliance & agreements',
    intro: 'Confirmed before activation. Upload documents from the “Members & docs” area.',
    fields: [
      { key: 'pcnLicenceValid', label: 'PCN premises licence current & valid?', type: 'yesno' },
      { key: 'superintendentPresent', label: 'Superintendent pharmacist on record & available?', type: 'yesno' },
      { key: 'storageStandards', label: 'Meet PCN storage / good-distribution standards?', type: 'yesno' },
      { key: 'ndprAware', label: 'Aware of NDPR / patient-data obligations?', type: 'yesno' },
      { key: 'agreeDataProtection', label: 'Agree to MobiCova’s data protection policy', type: 'agreement' },
      { key: 'agreeSla', label: 'Agree to the service-level agreement (SLA)', type: 'agreement' },
      { key: 'agreePharmacyStandards', label: 'Agree to MobiCova’s dispensing & quality standards', type: 'agreement' },
      { key: 'requireContract', label: 'Require a signed contract?', type: 'yesno' },
      { key: 'documentsReady', label: 'Documents ready to provide', type: 'multiselect', options: ['PCN premises licence', 'Superintendent pharmacist licence', 'CAC certificate', 'Tax certificate', 'Price list', 'Delivery SLA'] },
    ],
  },
];

// Fintech onboarding — a DISTRIBUTION partner (wallet / neobank / lending app)
// that brings its user base onto MobiCova as members. API-first, so integration
// and embedding matter; enrolment model is captured as a field since it varies
// per partner. Payments is a light section (a fintech may also fund/collect).
const FINTECH_SECTIONS: Section[] = [
  {
    key: 'identity', title: 'Company identity & licensing',
    intro: 'Confirm the fintech’s legal identity and CBN/regulatory standing.',
    fields: [
      { key: 'registeredName', label: 'Registered company name', type: 'text' },
      { key: 'tradingName', label: 'App / brand name (if different)', type: 'text' },
      { key: 'rcNumber', label: 'RC number (CAC)', type: 'text' },
      { key: 'cbnLicence', label: 'CBN licence type / number', type: 'text' },
      { key: 'licenceCategory', label: 'Licence category', type: 'select', options: ['Payment Service Bank (PSB)', 'Mobile Money Operator (MMO)', 'Payment Solution Service Provider (PSSP)', 'Switching & Processing', 'Microfinance Bank', 'Lending (state/CBN)', 'Other / partner-licensed'] },
      { key: 'tin', label: 'Tax Identification Number (TIN)', type: 'text' },
      { key: 'website', label: 'Website / app store link', type: 'url', placeholder: 'https://' },
      { key: 'address', label: 'Head office address', type: 'textarea' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'state', label: 'State', type: 'text' },
      { key: 'contactName', label: 'Primary contact — name', type: 'text' },
      { key: 'contactRole', label: 'Primary contact — role', type: 'text' },
      { key: 'contactPhone', label: 'Primary contact — phone', type: 'tel' },
      { key: 'contactEmail', label: 'Primary contact — email', type: 'email' },
    ],
  },
  {
    key: 'userbase', title: 'Business model & user base',
    fields: [
      { key: 'fintechType', label: 'What kind of fintech?', type: 'multiselect', options: ['Digital wallet', 'Neobank', 'Lending / BNPL', 'Savings / investments', 'Payments / transfers', 'Agency banking', 'Insurtech'] },
      { key: 'totalUsers', label: 'Total registered users', type: 'number' },
      { key: 'activeUsers', label: 'Monthly active users', type: 'number' },
      { key: 'userSegments', label: 'Main user segments', type: 'multiselect', options: ['Retail / individual', 'SME / merchants', 'Gig / informal workers', 'Salary earners', 'Students'] },
      { key: 'usersKyc', label: 'Are users already KYC-verified?', type: 'yesno', help: 'Verified identity speeds member onboarding' },
    ],
  },
  {
    key: 'distribution', title: 'Distribution & enrolment',
    intro: 'How the fintech’s users discover and join MobiCova.',
    fields: [
      { key: 'distributionModel', label: 'Distribution model', type: 'select', options: ['Embedded in our app', 'Co-branded MobiCova', 'Referral / deep-link', 'Standalone offer'] },
      { key: 'enrolmentModel', label: 'How do users become members?', type: 'select', options: ['Opt-in per user', 'Auto-enrol whole base', 'Auto-enrol selected segments', 'Mixed'] },
      { key: 'enrolSegments', label: 'Which segments (if auto-enrol)', type: 'text', showIf: (s) => String(s.enrolmentModel || '').startsWith('Auto-enrol') || s.enrolmentModel === 'Mixed' },
      { key: 'expectedMembers', label: 'Expected members on MobiCova', type: 'number' },
      { key: 'expectedTakeup', label: 'Expected take-up rate (if opt-in)', type: 'text', placeholder: 'e.g. 10% of active users' },
      { key: 'launchChannels', label: 'Launch channels', type: 'multiselect', options: ['In-app banner', 'Push notification', 'Email / SMS campaign', 'Agent network', 'Website'] },
      { key: 'coBranding', label: 'Co-brand the member experience?', type: 'yesno' },
    ],
  },
  {
    key: 'integration', title: 'Integration (API-first)',
    fields: [
      { key: 'integrationType', label: 'Preferred integration', type: 'select', options: ['REST API', 'SDK / embedded', 'Webhooks', 'Manual / file'] },
      { key: 'ssoForUsers', label: 'Single sign-on from your app into MobiCova?', type: 'yesno' },
      { key: 'userDataMethod', label: 'How will member data flow?', type: 'select', options: ['API sync', 'Bulk file', 'Manual entry'] },
      { key: 'sandboxNeeded', label: 'Need a sandbox / test environment?', type: 'yesno' },
      { key: 'webhookEvents', label: 'Want webhook events (enrolment, claims)?', type: 'yesno' },
    ],
  },
  {
    key: 'payments', title: 'Member payments (optional)',
    intro: 'A fintech may also collect or fund members’ health payments — capture it if so.',
    fields: [
      { key: 'handlesPayments', label: 'Will you collect / fund members’ health payments?', type: 'yesno' },
      { key: 'paymentMethods', label: 'Payment methods', type: 'multiselect', options: ['Wallet deduction', 'BNPL', 'Card', 'Bank transfer'], showIf: (s) => s.handlesPayments === true },
      { key: 'premiumModel', label: 'Who pays for cover?', type: 'select', options: ['Member pays', 'Fintech subsidises', 'Free tier + paid upgrades'] },
      { key: 'settlementCadence', label: 'Settlement cadence', type: 'select', options: ['Weekly', 'Bi-weekly', 'Monthly'] },
    ],
  },
  {
    key: 'commercials', title: 'Commercials & billing',
    fields: [
      { key: 'commercialModel', label: 'Commercial model', type: 'select', options: ['Revenue share', 'Per active member', 'Flat platform fee', 'Referral fee'] },
      { key: 'invoiceName', label: 'Invoices / remittance to — name', type: 'text' },
      { key: 'invoiceEmail', label: 'Invoices / remittance to — email', type: 'email' },
      { key: 'paymentMethod', label: 'Payment method', type: 'select', options: ['Bank transfer', 'Direct debit', 'Wallet funding'] },
    ],
  },
  {
    key: 'compliance', title: 'Compliance & agreements',
    intro: 'Confirmed before activation. Upload documents from the “Members & docs” area.',
    fields: [
      { key: 'ndprRegistered', label: 'Registered with NDPC (NDPR)?', type: 'yesno' },
      { key: 'dpoName', label: 'Data Protection Officer (name)', type: 'text' },
      { key: 'userConsent', label: 'Users consent to sharing data with MobiCova?', type: 'yesno' },
      { key: 'requireDpa', label: 'Require a signed Data Processing Agreement?', type: 'yesno' },
      { key: 'agreeDataProtection', label: 'Agree to MobiCova’s data protection policy', type: 'agreement' },
      { key: 'agreeSla', label: 'Agree to the service-level agreement (SLA)', type: 'agreement' },
      { key: 'agreeApiTerms', label: 'Agree to MobiCova’s API & integration terms', type: 'agreement' },
      { key: 'documentsReady', label: 'Documents ready to provide', type: 'multiselect', options: ['CBN licence', 'CAC certificate', 'Tax certificate', 'DPA template', 'API integration spec'] },
    ],
  },
];

// Pick the questionnaire for an org's type. Insurers, clinics, pharmacies and
// fintechs get purpose-built sets; everyone else (employer, telco…) uses the
// employer set for now.
function sectionsForType(type: string): Section[] {
  if (type === 'underwriter') return INSURER_SECTIONS;
  if (type === 'clinic') return CLINIC_SECTIONS;
  if (type === 'pharmacy') return PHARMACY_SECTIONS;
  if (type === 'fintech') return FINTECH_SECTIONS;
  return EMPLOYER_SECTIONS;
}

export default function OrgOnboardingWizard({ org, onClose, onSaved }: {
  org: Organisation; onClose: () => void; onSaved: () => void;
}) {
  const SECTIONS = sectionsForType(org.type);
  const [data, setData] = useState<Record<string, any>>({});
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    let on = true;
    adminGetOrgOnboarding(org.id)
      .then((res) => { if (on) setData(res.data || {}); })
      .catch(() => { /* empty draft is fine */ })
      .finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [org.id]);

  const section = SECTIONS[step];
  const sData = data[section.key] || {};
  const setField = (k: string, v: any) =>
    setData((d) => ({ ...d, [section.key]: { ...(d[section.key] || {}), [k]: v } }));

  const save = async (status: 'draft' | 'submitted') => {
    setBusy(true); setError(''); setSavedMsg('');
    try {
      await adminSaveOrgOnboarding(org.id, data, status);
      setSavedMsg(status === 'submitted' ? 'Onboarding submitted ✓' : 'Draft saved ✓');
      onSaved();
      if (status === 'submitted') setTimeout(onClose, 700);
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.error || 'Could not save.');
      else setError('Could not save.');
    } finally { setBusy(false); }
  };

  const pct = Math.round(((step + 1) / SECTIONS.length) * 100);

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="modal modal-wide ob-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ob-head">
          <div>
            <h3>Onboarding — {org.name}</h3>
            <p className="muted small">Step {step + 1} of {SECTIONS.length}: {section.title}</p>
          </div>
          <button className="ob-x" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="ob-progress"><div className="ob-progress-bar" style={{ width: `${pct}%` }} /></div>

        {/* Step rail */}
        <div className="ob-rail">
          {SECTIONS.map((s, i) => (
            <button
              key={s.key}
              className={`ob-rail-item ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`}
              onClick={() => setStep(i)}
              title={s.title}
            >{i + 1}</button>
          ))}
        </div>

        <div className="ob-body">
          {loading ? <p className="muted">Loading…</p> : (
            <>
              {section.intro && <p className="muted small ob-intro">{section.intro}</p>}
              {section.fields.map((f) => {
                if (f.showIf && !f.showIf(sData)) return null;
                return <FieldRow key={f.key} field={f} value={sData[f.key]} onChange={(v) => setField(f.key, v)} />;
              })}
            </>
          )}
        </div>

        {error && <div className="notice notice-error">{error}</div>}
        {savedMsg && <div className="notice notice-success">{savedMsg}</div>}

        <div className="ob-foot">
          <button className="btn btn-secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy}>← Back</button>
          <button className="btn btn-ghost" onClick={() => save('draft')} disabled={busy}>{busy ? 'Saving…' : 'Save draft'}</button>
          {step < SECTIONS.length - 1
            ? <button className="btn btn-primary" onClick={() => setStep((s) => Math.min(SECTIONS.length - 1, s + 1))} disabled={busy}>Next →</button>
            : <button className="btn btn-primary" onClick={() => save('submitted')} disabled={busy}>Submit onboarding</button>}
        </div>
      </div>
    </div>
  );
}

function FieldRow({ field, value, onChange }: { field: Field; value: any; onChange: (v: any) => void }) {
  const arr: string[] = Array.isArray(value) ? value : [];
  const toggle = (opt: string) => onChange(arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt]);

  return (
    <div className="form-group ob-field">
      <label>{field.label}</label>

      {(field.type === 'text' || field.type === 'number' || field.type === 'tel' || field.type === 'email' || field.type === 'url') && (
        <input
          type={field.type === 'number' ? 'number' : field.type === 'tel' ? 'tel' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
          value={value ?? ''} placeholder={field.placeholder}
          onChange={(e) => onChange(field.type === 'number' ? e.target.value.replace(/[^0-9]/g, '') : e.target.value)}
        />
      )}

      {field.type === 'textarea' && (
        <textarea rows={2} value={value ?? ''} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
      )}

      {field.type === 'select' && (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {field.options!.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}

      {field.type === 'yesno' && (
        <div className="ob-yesno">
          <button type="button" className={value === true ? 'on' : ''} onClick={() => onChange(true)}>Yes</button>
          <button type="button" className={value === false ? 'on' : ''} onClick={() => onChange(false)}>No</button>
        </div>
      )}

      {field.type === 'multiselect' && (
        <div className="ob-chips">
          {field.options!.map((o) => (
            <button type="button" key={o} className={`ob-chip ${arr.includes(o) ? 'on' : ''}`} onClick={() => toggle(o)}>{o}</button>
          ))}
        </div>
      )}

      {field.type === 'agreement' && (
        <label className="ob-agree">
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          <span>I confirm the above</span>
        </label>
      )}

      {field.type === 'branches' && (
        <BranchList value={Array.isArray(value) ? value : []} onChange={onChange} />
      )}
    </div>
  );
}

function BranchList({ value, onChange }: { value: any[]; onChange: (v: any[]) => void }) {
  const set = (i: number, k: string, v: string) => {
    const next = value.map((b, idx) => (idx === i ? { ...b, [k]: v } : b));
    onChange(next);
  };
  return (
    <div className="ob-branches">
      {value.map((b, i) => (
        <div className="ob-branch" key={i}>
          <input placeholder="Branch name" value={b.name ?? ''} onChange={(e) => set(i, 'name', e.target.value)} />
          <input placeholder="Staff" type="number" value={b.staff ?? ''} onChange={(e) => set(i, 'staff', e.target.value.replace(/[^0-9]/g, ''))} />
          <button type="button" className="ob-branch-x" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>×</button>
        </div>
      ))}
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange([...value, { name: '', staff: '' }])}>+ Add branch</button>
    </div>
  );
}
