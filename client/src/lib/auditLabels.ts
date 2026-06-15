// Human-readable label + colour band for each audit action verb. Shared by the
// partner Activity log and the platform-admin Audit tab.

export const ACTION_META: Record<string, { label: string; tone: string }> = {
  // members
  'member.create': { label: 'Member added', tone: 'badge-green' },
  'member.import': { label: 'Members imported', tone: 'badge-green' },
  'member.enrol': { label: 'Member self-enrolled', tone: 'badge-green' },
  'member.login': { label: 'Member signed in', tone: 'badge-gray' },
  // auth
  'auth.login': { label: 'Signed in', tone: 'badge-gray' },
  'auth.mfa_enabled': { label: '2FA enabled', tone: 'badge-blue' },
  'auth.mfa_disabled': { label: '2FA disabled', tone: 'badge-amber' },
  'auth.sso_login': { label: 'SSO sign-in', tone: 'badge-gray' },
  'auth.sso_denied': { label: 'SSO denied', tone: 'badge-red' },
  // organisations
  'org.create': { label: 'Organisation created', tone: 'badge-green' },
  'org.update': { label: 'Organisation updated', tone: 'badge-blue' },
  'org.suspend': { label: 'Organisation suspended', tone: 'badge-gray' },
  'org.reactivate': { label: 'Organisation reactivated', tone: 'badge-green' },
  'org.delete': { label: 'Organisation deleted', tone: 'badge-red' },
  'org.sso_update': { label: 'SSO settings updated', tone: 'badge-blue' },
  // users
  'user.create': { label: 'User created', tone: 'badge-green' },
  'user.update': { label: 'User updated', tone: 'badge-blue' },
  'user.activate': { label: 'User activated', tone: 'badge-green' },
  'user.deactivate': { label: 'User deactivated', tone: 'badge-gray' },
  'user.reset_password': { label: 'Password reset', tone: 'badge-blue' },
  'user.delete': { label: 'User deleted', tone: 'badge-red' },
  // providers / clinicians
  'provider.create': { label: 'Clinician added', tone: 'badge-green' },
  'provider.update': { label: 'Clinician updated', tone: 'badge-blue' },
  'provider.reset_password': { label: 'Clinician password reset', tone: 'badge-blue' },
  'provider.delete': { label: 'Clinician removed', tone: 'badge-red' },
  // claims
  'claim.create': { label: 'Claim submitted', tone: 'badge-green' },
  'claim.under_review': { label: 'Claim under review', tone: 'badge-amber' },
  'claim.approved': { label: 'Claim approved', tone: 'badge-green' },
  'claim.rejected': { label: 'Claim rejected', tone: 'badge-red' },
  'claim.paid': { label: 'Claim paid', tone: 'badge-green' },
  'claim.document_add': { label: 'Claim document added', tone: 'badge-blue' },
  // catalog / billing / branding / developer
  'plan.create': { label: 'Plan created', tone: 'badge-green' },
  'plan.update': { label: 'Plan updated', tone: 'badge-blue' },
  'plan.delete': { label: 'Plan deleted', tone: 'badge-red' },
  'partner.create': { label: 'Partner created', tone: 'badge-green' },
  'partner.update': { label: 'Partner updated', tone: 'badge-blue' },
  'partner.delete': { label: 'Partner deleted', tone: 'badge-red' },
  'branding.update': { label: 'Branding updated', tone: 'badge-blue' },
  'billing.plan_change': { label: 'Plan changed', tone: 'badge-blue' },
  'apikey.create': { label: 'API key created', tone: 'badge-green' },
  'apikey.revoke': { label: 'API key revoked', tone: 'badge-amber' },
  'webhook.create': { label: 'Webhook created', tone: 'badge-green' },
  'webhook.delete': { label: 'Webhook deleted', tone: 'badge-red' },
};

export function actionMeta(action: string): { label: string; tone: string } {
  return ACTION_META[action] ?? { label: action, tone: 'badge-gray' };
}

export function auditWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
