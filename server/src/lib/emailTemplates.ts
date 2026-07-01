// Plain, dependency-free HTML email templates. Kept deliberately simple so they
// render everywhere; branding can be layered in later.

interface Tpl { subject: string; html: string; text: string }

const BRAND = '#0a7b7b';

function shell(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f6f9f9;font-family:Arial,Helvetica,sans-serif;color:#0d2a2a">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="font-size:20px;font-weight:800;color:${BRAND};margin-bottom:16px">MobiCova Health</div>
    <div style="background:#fff;border:1px solid #e2ebf0;border-radius:14px;padding:24px">
      <h1 style="font-size:18px;margin:0 0 12px">${title}</h1>
      ${body}
    </div>
    <p style="font-size:12px;color:#94a8ad;margin-top:16px">MobiCova Health · This is an automated message.</p>
  </div></body></html>`;
}

function button(label: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;
    padding:12px 20px;border-radius:10px;font-weight:700;margin:8px 0">${label}</a>`;
}

// Welcome for a new organisation admin. Either an activation link (no password
// set yet) or a direct login link.
export function adminWelcomeEmail(o: {
  fullName: string; orgName: string; loginUrl: string; activateUrl?: string;
}): Tpl {
  const subject = `You've been added as an admin for ${o.orgName} on MobiCova`;
  const lead = `<p>Hi ${o.fullName || 'there'},</p>
    <p>You've been set up as an administrator for <strong>${o.orgName}</strong> on the MobiCova
    Digital Health platform.</p>`;
  const cta = o.activateUrl
    ? `<p>To get started, set your password:</p>${button('Set your password', o.activateUrl)}
       <p style="font-size:13px;color:#4a5d61">This link expires in 7 days. After setting your password
       you'll sign in here:<br><a href="${o.loginUrl}">${o.loginUrl}</a></p>`
    : `<p>You can sign in here:</p>${button('Sign in', o.loginUrl)}
       <p style="font-size:13px;color:#4a5d61">Use the password your administrator shared with you.</p>`;
  const html = shell('Welcome to MobiCova', lead + cta);
  const text = `Hi ${o.fullName || 'there'},\n\nYou've been set up as an administrator for ${o.orgName} on MobiCova.\n\n`
    + (o.activateUrl
      ? `Set your password (link expires in 7 days):\n${o.activateUrl}\n\nThen sign in at:\n${o.loginUrl}\n`
      : `Sign in at:\n${o.loginUrl}\nUse the password your administrator shared.\n`);
  return { subject, html, text };
}

// Password-reset link for a staff user or provider who used "forgot password".
export function passwordResetEmail(o: { fullName?: string; resetUrl: string }): Tpl {
  const subject = 'Reset your MobiCova password';
  const body = `<p>Hi ${o.fullName || 'there'},</p>
    <p>We received a request to reset the password for your MobiCova account. Click below to choose a new one:</p>
    ${button('Reset your password', o.resetUrl)}
    <p style="font-size:13px;color:#4a5d61">This link expires in 1 hour and can be used once. If you didn't
    request this, you can safely ignore this email — your password won't change.</p>`;
  const html = shell('Reset your password', body);
  const text = `Hi ${o.fullName || 'there'},\n\nReset your MobiCova password using this link (expires in 1 hour, single use):\n`
    + `${o.resetUrl}\n\nIf you didn't request this, ignore this email — your password won't change.\n`;
  return { subject, html, text };
}

// Welcome for a newly enrolled member: how to reach the platform.
export function memberWelcomeEmail(o: {
  fullName: string; orgName: string; portalUrl: string; joinCode: string;
}): Tpl {
  const subject = `Your ${o.orgName} health cover on MobiCova`;
  const body = `<p>Hi ${o.fullName || 'there'},</p>
    <p><strong>${o.orgName}</strong> has enrolled you on MobiCova — telemedicine, an AI health
    assistant, and your health cover, in one place.</p>
    <p>Open the member portal and sign in with this email or your phone number — we'll text/show you a
    one-time code (no password needed):</p>
    ${button('Open the member app', o.portalUrl)}
    ${o.joinCode ? `<p style="font-size:13px;color:#4a5d61">On WhatsApp or USSD, you can also enrol with
    your organisation's join code: <strong>${o.joinCode}</strong></p>` : ''}`;
  const html = shell('Welcome to MobiCova', body);
  const text = `Hi ${o.fullName || 'there'},\n\n${o.orgName} has enrolled you on MobiCova.\n\n`
    + `Open the member portal and sign in with this email or your phone (one-time code, no password):\n${o.portalUrl}\n`
    + (o.joinCode ? `\nWhatsApp/USSD join code: ${o.joinCode}\n` : '');
  return { subject, html, text };
}
