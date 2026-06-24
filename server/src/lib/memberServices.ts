import { query } from '../config/database';

// Member self-service shared by the USSD and WhatsApp channels. On telco channels
// there is no password — the member is identified by the phone number that
// initiated the session (the MSISDN), matched to their record. The same menu +
// actions back both channels so behaviour stays consistent.

// Numbers arrive in many formats (+234…, 234…, 080…), so match on the last 10 digits.
function last10(phone: string): string {
  return (phone || '').replace(/\D/g, '').slice(-10);
}

export interface ChannelMember {
  id: string;
  org_id: string;
  full_name: string;
  phone: string;
}

// Resolve an active member from the calling/sending number, or null if unknown.
export async function findMemberByPhone(phone: string): Promise<ChannelMember | null> {
  const key = last10(phone);
  if (key.length < 7) return null;
  const r = await query(
    `SELECT id, org_id, full_name, phone FROM members
      WHERE status = 'active'
        AND right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = $1
      ORDER BY created_at DESC LIMIT 1`,
    [key]
  );
  return r.rows[0] ?? null;
}

// The member menu (numeric options work on both channels).
export function memberMenu(fullName: string): string {
  const first = (fullName || '').split(' ')[0] || 'there';
  return `Hi ${first}! MobiCova member services:\n1 My cover\n2 My claims\n3 My prescriptions\n4 Request a doctor callback\n0 Health Buddy`;
}

// Handle a numeric menu choice and return the reply text. Returns null for an
// option this module doesn't own (e.g. "0" = Health Buddy, handled per channel).
export async function handleMemberChoice(member: ChannelMember, choice: string, channel: string): Promise<string | null> {
  switch (choice) {
    case '1': {
      const r = await query(
        `SELECT pl.name, e.status, e.payment_status, pl.monthly_premium, pl.currency
           FROM enrolments e JOIN insurance_plans pl ON e.plan_id = pl.id
          WHERE e.member_id = $1 ORDER BY e.enrolled_at DESC LIMIT 1`,
        [member.id]
      );
      if (!r.rows.length) return 'No active cover on record. Please contact your provider to enrol.';
      const c = r.rows[0];
      return `Cover: ${c.name}\nStatus: ${c.status} (${c.payment_status})\nPremium: ${c.currency} ${Number(c.monthly_premium).toLocaleString()}/mo`;
    }
    case '2': {
      const r = await query(
        `SELECT reference, claim_type, amount, currency, status FROM claims
          WHERE member_id = $1 ORDER BY created_at DESC LIMIT 3`,
        [member.id]
      );
      if (!r.rows.length) return 'No claims on record.';
      return 'Recent claims:\n' + r.rows.map((c: any) =>
        `${c.reference || c.claim_type}: ${c.currency} ${Number(c.amount).toLocaleString()} — ${c.status}`).join('\n');
    }
    case '3': {
      const r = await query(
        `SELECT medication, fulfilment_status FROM prescriptions
          WHERE member_id = $1 ORDER BY created_at DESC LIMIT 3`,
        [member.id]
      );
      if (!r.rows.length) return 'No prescriptions on record.';
      return 'Your prescriptions:\n' + r.rows.map((p: any) => `${p.medication} — ${p.fulfilment_status}`).join('\n');
    }
    case '4': {
      // Log a callback request as a scheduled consultation so it lands in a
      // doctor's queue. Route to the telemedicine partner so the right team sees it.
      const p = await query(`SELECT id FROM partners WHERE category = 'telemedicine' ORDER BY name LIMIT 1`);
      const partnerId = p.rows[0]?.id ?? null;
      await query(
        `INSERT INTO consultations (org_id, member_id, partner_id, mode, channel, reason, scheduled_at, status, doctor_name)
         VALUES ($1, $2, $3, 'voice', $4, 'Member requested a callback', NOW(), 'scheduled', 'MobiCova Doctor')`,
        [member.org_id, member.id, partnerId, channel]
      );
      const first = (member.full_name || '').split(' ')[0] || '';
      return `Thanks ${first}! A MobiCova doctor will call you back shortly.`;
    }
    default:
      return null;
  }
}
