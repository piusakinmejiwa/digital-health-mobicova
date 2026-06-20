import bcrypt from 'bcryptjs';
import { pool, query } from '../config/database';
import { newMembershipId } from '../lib/membership';

// Password for the demo accounts (admin + providers). Override per-deployment
// with DEMO_SEED_PASSWORD so the real value never needs to live in the repo.
// Deliberately NOT 'password123' — that was previously exposed on the login page.
const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD || 'MobiCova!Demo-2026';

const partners = [
  // Telemedicine providers
  ['Helium Health', 'telemedicine', 'Licensed physicians, clinical protocols, specialist networks', 'National', 'MDCN-registered network'],
  ['Reliance HMO', 'telemedicine', 'Telemedicine and managed care with specialist referral', 'Multi-state', 'MDCN / NHIA'],
  ['DrConsult', 'telemedicine', 'Video and voice consultations with licensed doctors', 'National', 'MDCN-registered'],
  // Insurers / HMOs
  ['Acme Health HMO', 'insurer', 'Underwriting, risk capital, claims processing, hospital panels', 'National', 'NAICOM / NHIA'],
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
    'Essential Health Cover', 'individual', 'Acme Health HMO', 2500, 1500000,
    ['Telemedicine consultations', 'Outpatient care', 'Basic diagnostics', 'Prescription discounts'],
    'Entry-level individual health protection with telemedicine access.', 20,
  ],
  [
    'Family Health Plan', 'family', 'Acme Health HMO', 7500, 5000000,
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
  const demoEmail = 'admin@acme-health.demo';
  const existing = await query('SELECT id FROM users WHERE email = $1', [demoEmail]);
  if (existing.rows.length === 0) {
    console.log('Seeding demo organisation + admin...');
    const org = await query(
      `INSERT INTO organisations (name, slug, type, plan_tier, join_code)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['Acme Health HMO', 'acme-health', 'underwriter', 'growth', '100200']
    );
    const orgId = org.rows[0].id;
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    await query(
      `INSERT INTO users (org_id, email, password_hash, full_name, role, is_platform_admin)
       VALUES ($1, $2, $3, $4, 'admin', true)`,
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
      const membershipId = await newMembershipId(orgId);
      await query(
        `INSERT INTO members (org_id, full_name, gender, date_of_birth, channel, blood_group, allergies, chronic_conditions, email, phone, membership_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [orgId, name, gender, dob, channel, blood, allergies, conditions,
         name.toLowerCase().replace(' ', '.') + '@member.demo', '+234' + Math.floor(7000000000 + Math.random() * 999999999),
         membershipId]
      );
    }
  } else {
    console.log('Demo organisation already exists — ensuring platform-admin access + rotating password.');
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    await query('UPDATE users SET is_platform_admin = true, password_hash = $2 WHERE email = $1', [demoEmail, passwordHash]);
    // Ensure the demo org has a join code so USSD/WhatsApp enrolment works.
    await query(
      "UPDATE organisations SET join_code = '100200' WHERE slug = 'acme-health' AND (join_code IS NULL OR join_code = '')"
    );
  }

  await seedProviders();

  console.log('Seed complete.');
  await pool.end();
}

// Q9 — demo providers (a doctor + a pharmacist) plus a little queue data so the
// provider portal has something to show on first sign-in. Idempotent: safe to
// re-run against an already-seeded database.
async function seedProviders() {
  console.log('Seeding demo providers...');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const telco = await query(`SELECT id FROM partners WHERE name = 'Helium Health' LIMIT 1`);
  const pharma = await query(`SELECT id FROM partners WHERE name = 'HealthPlus' LIMIT 1`);
  const telePartnerId = telco.rows[0]?.id;
  const pharmacyPartnerId = pharma.rows[0]?.id;
  if (!telePartnerId || !pharmacyPartnerId) {
    console.log('  partners not found — skipping provider seed.');
    return;
  }

  async function upsertProvider(email: string, fullName: string, role: string, specialty: string, partnerId: string, photoUrl = '') {
    const exists = await query('SELECT id FROM providers WHERE email = $1', [email]);
    if (exists.rows.length > 0) {
      await query('UPDATE providers SET password_hash = $1, photo_url = $2 WHERE id = $3', [passwordHash, photoUrl, exists.rows[0].id]);
      return exists.rows[0].id;
    }
    const r = await query(
      `INSERT INTO providers (partner_id, full_name, email, password_hash, role, specialty, photo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [partnerId, fullName, email, passwordHash, role, specialty, photoUrl]
    );
    return r.rows[0].id;
  }

  const doctorId = await upsertProvider('doctor@mobicova.demo', 'Dr. Adaeze Okonkwo', 'doctor', 'General Practice', telePartnerId, '/images/doctor.jpg');
  const pharmacistId = await upsertProvider('pharmacist@mobicova.demo', 'Pharm. Bode Adesina', 'pharmacist', '', pharmacyPartnerId);

  // Unified org model: a demo clinic org + pharmacy org, each with its own admin,
  // so the platform shows supply-side organisations managed individually. The
  // orgs carry legacy_partner_id so the general data migration treats them as
  // already-migrated (no duplicates).
  async function ensureSupplyOrg(
    partnerId: string, name: string, slug: string, type: string,
    adminEmail: string, adminName: string
  ): Promise<string> {
    const found = await query('SELECT id FROM organisations WHERE legacy_partner_id = $1 LIMIT 1', [partnerId]);
    let orgId: string;
    if (found.rows.length > 0) {
      orgId = found.rows[0].id;
    } else {
      const r = await query(
        `INSERT INTO organisations (name, slug, type, country, join_code, legacy_partner_id)
         VALUES ($1, $2, $3, 'Nigeria', '', $4) RETURNING id`,
        [name, slug, type, partnerId]
      );
      orgId = r.rows[0].id;
    }
    const u = await query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (u.rows.length === 0) {
      await query(
        `INSERT INTO users (org_id, email, password_hash, full_name, role)
         VALUES ($1, $2, $3, $4, 'admin')`,
        [orgId, adminEmail, passwordHash, adminName]
      );
    } else {
      await query('UPDATE users SET org_id = $2, password_hash = $3 WHERE email = $1', [adminEmail, orgId, passwordHash]);
    }
    return orgId;
  }

  const clinicOrgId = await ensureSupplyOrg(
    telePartnerId, 'Helium Health', 'helium-health', 'clinic',
    'clinic@mobicova.demo', 'Clinic Admin'
  );
  const pharmacyOrgId = await ensureSupplyOrg(
    pharmacyPartnerId, 'HealthPlus', 'healthplus', 'pharmacy',
    'pharmacy@mobicova.demo', 'Pharmacy Admin'
  );

  // Link the demo providers to their organisation (many-to-many).
  await query(
    `INSERT INTO provider_organisations (provider_id, org_id, is_primary)
     VALUES ($1, $2, true) ON CONFLICT (provider_id, org_id) DO NOTHING`,
    [doctorId, clinicOrgId]
  );
  await query(
    `INSERT INTO provider_organisations (provider_id, org_id, is_primary)
     VALUES ($1, $2, true) ON CONFLICT (provider_id, org_id) DO NOTHING`,
    [pharmacistId, pharmacyOrgId]
  );

  // A second clinic so the demo doctor can demonstrate the multi-clinic switcher.
  const tele2 = await query(`SELECT id FROM partners WHERE name = 'DrConsult' LIMIT 1`);
  const tele2PartnerId = tele2.rows[0]?.id;
  if (tele2PartnerId) {
    const clinic2OrgId = await ensureSupplyOrg(
      tele2PartnerId, 'DrConsult', 'drconsult', 'clinic',
      'clinic2@mobicova.demo', 'Clinic Admin (DrConsult)'
    );
    await query(
      `INSERT INTO provider_organisations (provider_id, org_id, is_primary)
       VALUES ($1, $2, false) ON CONFLICT (provider_id, org_id) DO NOTHING`,
      [doctorId, clinic2OrgId]
    );
  }

  // Find the demo org + a member to attach queue data to.
  const org = await query(`SELECT id FROM organisations WHERE slug = 'acme-health' LIMIT 1`);
  const orgId = org.rows[0]?.id;
  if (!orgId) return;
  const member = await query(`SELECT id FROM members WHERE org_id = $1 ORDER BY created_at LIMIT 1`, [orgId]);
  const memberId = member.rows[0]?.id;
  if (!memberId) return;

  // Ensure the doctor has at least one scheduled consult waiting.
  const pending = await query(
    `SELECT id FROM consultations WHERE partner_id = $1 AND status = 'scheduled' LIMIT 1`,
    [telePartnerId]
  );
  if (pending.rows.length === 0) {
    await query(
      `INSERT INTO consultations (org_id, member_id, partner_id, mode, channel, reason, scheduled_at, status)
       VALUES ($1, $2, $3, 'video', 'app', $4, NOW() + interval '1 hour', 'scheduled')`,
      [orgId, memberId, telePartnerId, 'Persistent headache and mild fever for 3 days']
    );
  }

  // Ensure the pharmacist has at least one pending prescription waiting.
  const pendingRx = await query(
    `SELECT id FROM prescriptions WHERE pharmacy_partner = 'HealthPlus' AND fulfilment_status = 'pending' LIMIT 1`
  );
  if (pendingRx.rows.length === 0) {
    const c = await query(
      `INSERT INTO consultations (org_id, member_id, partner_id, mode, channel, reason, scheduled_at, status, doctor_name, diagnosis)
       VALUES ($1, $2, $3, 'video', 'app', $4, NOW() - interval '1 day', 'completed', 'Dr. Adaeze Okonkwo', 'Acute bacterial sinusitis')
       RETURNING id`,
      [orgId, memberId, telePartnerId, 'Facial pain and congestion']
    );
    await query(
      `INSERT INTO prescriptions (consultation_id, member_id, medication, dosage, instructions, pharmacy_partner, fulfilment_status)
       VALUES ($1, $2, 'Amoxicillin-clavulanate 625mg', '1 tablet twice daily', 'Take with food for 7 days', 'HealthPlus', 'pending')`,
      [c.rows[0].id, memberId]
    );
  }

  // Route the seeded queue rows to the new supply orgs (idempotent).
  await query(
    `UPDATE consultations SET provider_org_id = $1 WHERE partner_id = $2 AND provider_org_id IS NULL`,
    [clinicOrgId, telePartnerId]
  );
  await query(
    `UPDATE prescriptions SET pharmacy_org_id = $1 WHERE pharmacy_partner = 'HealthPlus' AND pharmacy_org_id IS NULL`,
    [pharmacyOrgId]
  );
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
