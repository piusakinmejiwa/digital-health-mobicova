import { env } from '../config/env';
import { sendEmail } from './email';
import { issueActivationToken } from './invites';
import { adminWelcomeEmail, memberWelcomeEmail } from './emailTemplates';
import { smsConfigured, whatsappConfigured, sendSms, sendWhatsApp } from './messaging';

// Orchestrates onboarding emails. All functions are best-effort: they never throw
// (so they can't break account creation) — failures are logged.

export async function sendAdminWelcome(opts: {
  userId: string; email: string; fullName: string;
  orgName: string; orgSlug: string; needsActivation: boolean;
}): Promise<void> {
  try {
    const loginUrl = `${env.clientUrl}/o/${opts.orgSlug}/login`;
    let activateUrl: string | undefined;
    if (opts.needsActivation) {
      const token = await issueActivationToken(opts.userId);
      activateUrl = `${env.clientUrl}/activate?token=${encodeURIComponent(token)}`;
    }
    const tpl = adminWelcomeEmail({ fullName: opts.fullName, orgName: opts.orgName, loginUrl, activateUrl });
    await sendEmail({ to: opts.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
  } catch (err) {
    console.error('[onboarding] admin welcome failed:', err);
  }
}

// Introductory message to a new member. Email if we have one (branded as the
// organisation, from the org alias); otherwise SMS + WhatsApp for phone-only
// members (which only deliver once those channels are live — gated, no-op until
// then). Best-effort: never throws.
export async function sendMemberWelcome(opts: {
  email?: string; phone?: string; fullName?: string; orgName: string; joinCode: string;
}): Promise<void> {
  try {
    const portalUrl = `${env.clientUrl}/member/login`;

    if (opts.email) {
      const tpl = memberWelcomeEmail({ fullName: opts.fullName || '', orgName: opts.orgName, portalUrl, joinCode: opts.joinCode });
      // Branded as the organisation: display name = org, address = the org alias.
      const safeName = opts.orgName.replace(/["\r\n]/g, '').trim() || 'MobiCova';
      const from = `${safeName} <${env.orgEmailAlias}>`;
      await sendEmail({ to: opts.email, subject: tpl.subject, html: tpl.html, text: tpl.text, from });
      return;
    }

    // Phone-only member: short welcome over SMS and/or WhatsApp (best-effort,
    // gated — does nothing until those channels are configured/live).
    if (opts.phone) {
      const code = opts.joinCode ? ` Join code: ${opts.joinCode}.` : '';
      const msg = `Welcome to ${opts.orgName} on MobiCova health cover! Use it on any phone via WhatsApp or USSD.${code}`;
      if (smsConfigured()) await sendSms(opts.phone, msg);
      if (whatsappConfigured()) await sendWhatsApp(opts.phone, msg);
    }
  } catch (err) {
    console.error('[onboarding] member welcome failed:', err);
  }
}
