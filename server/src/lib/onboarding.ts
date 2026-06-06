import { env } from '../config/env';
import { sendEmail } from './email';
import { issueActivationToken } from './invites';
import { adminWelcomeEmail, memberWelcomeEmail } from './emailTemplates';

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

export async function sendMemberWelcome(opts: {
  email: string; fullName: string; orgName: string; joinCode: string;
}): Promise<void> {
  try {
    if (!opts.email) return;
    const portalUrl = `${env.clientUrl}/member/login`;
    const tpl = memberWelcomeEmail({ fullName: opts.fullName, orgName: opts.orgName, portalUrl, joinCode: opts.joinCode });
    await sendEmail({ to: opts.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
  } catch (err) {
    console.error('[onboarding] member welcome failed:', err);
  }
}
