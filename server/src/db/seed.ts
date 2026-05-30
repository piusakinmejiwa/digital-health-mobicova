import bcrypt from 'bcryptjs';
import { pool, query } from '../config/database';

const partners = [
  // Telemedicine providers
  ['Helium Health', 'telemedicine', 'Licensed physicians, clinical protocols, specialist networks', 'National', 'MDCN-registered network'],
  ['Reliance HMO', 'telemedicine', 'Telemedicine and managed care with specialist referral', 'Multi-state', 'MDCN / NHIA'],
  ['DrConsult', 'telemedicine', 'Video and voice consultations with licensed doctors', 'National', 'MDCN-registered'],
  // Insurers / HMOs
  ['AXA Mansard', 'insurer', 'Underwriting, risk capital, claims processing, hospital panels', 'National', 'NAICOM / NHIA'],
  ['Leadway', 'insurer', 'Health and accident underwriting at scale', 'National', 'NAICOM'],
  ['Hygeia HMO', 'insurer', 'Managed health insurance and hospital networks', 'Multi-state', 'NHIA'],
  ['Avon HMO', 'insurer', 'Family and corporate health plans', 'Multi-state', 'NHIA'],
  // Pharmacy networks
  ['HealthPlus', 'pharmacy', 'Medication dispensing and home delivery', 'National', 'PCN-registered'],
  ['MedPlus', 'pharmacy', 'Retail pharmacy network and e-prescription fulfilment', 'National', 'PCN-registered'],
  ['DrugStoc', 'pharmacy', 'Pharmaceutical distribution and supply', 'National', 'PCN-registered'],
  // Diagnostic labs
  ['Lancet', 'diagnostics', 'Lab tests, sample collection, digital results', 'Multi-state', 'MLSCN-accredited'],
  ['Synlab', 'diagnostics', 'Diagnostic testing and specialist referral pathways', 'National', 'MLSCN-accredited'],
  ['PathCare', 'diagnostics', 'Pathology and home sample collection', 'Multi-state', 'MLSCN-accredited'],
  // EHR / Health IT
  ['MDaaS Global', 'ehr', 'FHIR-compliant health record infrastructure and diagnostics', 'Multi-state', 'Health IT provider'],
  // Distribution partners
  ['MTN', 'distribution', 'Telco distribution rails — USSD, SMS, mobile', 'National', 'NCC-licensed'],
  ['Flutterwave', 'distribution', 'Payments and embedded financial distribution', 'National', 'CBN-licensed'],
  ['Cowrywise', 'distribution', 'Fintech distribution to mass-market savers', 'National', 'SEC-registered'],
];

const plans: [string, string, string, number, number, string[], string, number][] = [
  // name, type, underwriter, monthly_premium, cover_amount, benefits, description, commission
  [
    'Essential Health Cover', 'individual', 'AXA Mansard', 2500, 1500000,
    ['Telemedicine consultations', 'Outpatient care', 'Basic diagnostics', 'Prescription discounts'],
    'Entry-level individual health protection with telemedicine access.', 20,
  ],
  [
    'Family Health Plan', 'family', 'AXA Mansard', 7500, 5000000,
    ['Cover for up to 5 dependants', 'Telemedicine + specialist referrals', 'Maternal care', 'Diagnostics & pharmacy'],
    'Comprehensive cover for the whole family across all MobiCova channels.', 18,
  ],
  [
    'Hospital Cash Micro-Insurance', 'hospital_cash', 'Leadway', 500, 200000,
    ['Daily cash benefit during hospitalisation', 'No medical exam', 'Pays direct to member', 'Affordable monthly premium'],
    'Daily cash benefit paid for each day of hospital admission.', 25,
  ],
  [
    'Group Corporate Health', 'group', 'Hygeia HMO', 4000, 3000000,
    ['Per-employee managed care', 'Telemedicine for all staff', 'Wellness programmes', 'HR enrolment dashboard'],
    'Employer-sponsored managed health cover for staff groups.', 15,
  ],
  [
    'Wellness-Linked Cover', 'wellness', 'Avon HMO', 3000, 2000000,
    ['Premium discounts for health engagement', 'Chronic disease support', 'Telemedicine', 'Annual health check'],
    'Cover with premiums that reward healthy engagement.', 18,
  ],
];

async function seed() {
  console.log('Seeding partners...');
  for (const [name, category, description, coverage, licence] of partners) {
    const exists = await query('SELECT 1 FROM partners WHERE name = $1', [name]);
    if (exists.rows.length === 0) {
      await query(
        `INSERT INTO partners (name, category, description, coverage, licence)
         VALUES ($1, $2, $3, $4, $5)`,
        [name, category, description, coverage, licence]
      );
    }
  }

  console.log('Seeding insurance plans...');
  for (const [name, planType, underwriter, premium, cover, benefits, description, commission] of plans) {
    const exists = await query('SELECT 1 FROM insurance_plans WHERE name = $1', [name]);
    if (exists.rows.length === 0) {
      await query(
        `INSERT INTO insurance_plans (name, plan_type, underwriter, monthly_premium, cover_amount, benefits, description, commission_rate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [name, planType, underwriter, premium, cover, benefits, description, commission]
      );
    }
  }

  // Demo partner organisation + admin
  const demoEmail = 'admin@axamansard.demo';
  const existing = await query('SELECT id FROM users WHERE email = $1', [demoEmail]);
  if (existing.rows.length === 0) {
    console.log('Seeding demo organisation + admin...');
    const org = await query(
      `INSERT INTO organisations (name, slug, partner_type, plan_tier)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      ['AXA Mansard Health', 'axa-mansard-health', 'insurer', 'growth']
    );
    const orgId = org.rows[0].id;
    const passwordHash = await bcrypt.hash('password123', 12);
    await query(
      `INSERT INTO users (org_id, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, 'admin')`,
      [orgId, demoEmail, passwordHash, 'Demo Admin']
    );

    // A few demo members
    const demoMembers: [string, string, string, string, string, string[], string[]][] = [
      ['Amaka Obi', 'female', '1990-04-12', 'app', 'O+', ['Penicillin'], ['Hypertension']],
      ['Tunde Bello', 'male', '1985-11-02', 'whatsapp', 'A+', [], ['Type 2 Diabetes']],
      ['Ngozi Eze', 'female', '1996-07-21', 'app', 'B+', [], []],
      ['Yusuf Sani', 'male', '1978-01-30', 'ussd', 'AB+', ['Sulfa drugs'], ['Asthma']],
    ];
    for (const [name, gender, dob, channel, blood, allergies, conditions] of demoMembers) {
      await query(
        `INSERT INTO members (org_id, full_name, gender, date_of_birth, channel, blood_group, allergies, chronic_conditions, email, phone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [orgId, name, gender, dob, channel, blood, allergies, conditions,
         name.toLowerCase().replace(' ', '.') + '@member.demo', '+234' + Math.floor(7000000000 + Math.random() * 999999999)]
      );
    }
  } else {
    console.log('Demo organisation already exists, skipping.');
  }

  console.log('Seed complete.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
