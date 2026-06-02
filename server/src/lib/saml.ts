import { SAML } from '@node-saml/node-saml';
import { query } from '../config/database';
import { env } from '../config/env';

// SAML SSO helpers. The platform acts as the SAML Service Provider (SP); each
// partner organisation configures their own identity provider (IdP). Config is
// stored per-org in the org_sso table (see migration 013).

export interface OrgSsoRow {
  org_id: string;
  enabled: boolean;
  entry_point: string;
  idp_issuer: string;
  idp_cert: string;
  email_attribute: string;
}

export interface OrgWithSso {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  sso: OrgSsoRow | null;
}

// --- Service Provider identifiers, derived from the API's public URL + slug ---
// These are what a partner hands to their IdP admin. Stable per org as long as
// SERVER_URL and the org slug don't change.
export function spEntityId(slug: string): string {
  return `${env.serverUrl}/api/v1/auth/saml/${slug}/metadata`;
}
export function spCallbackUrl(slug: string): string {
  return `${env.serverUrl}/api/v1/auth/saml/${slug}/callback`;
}
export function spLoginUrl(slug: string): string {
  return `${env.serverUrl}/api/v1/auth/saml/${slug}/login`;
}

// Load an org plus its SSO config (if any) by slug. Returns null when the org
// doesn't exist; .sso is null when no config row has been created yet.
export async function loadOrgSsoBySlug(slug: string): Promise<OrgWithSso | null> {
  const r = await query(
    `SELECT o.id, o.name, o.slug, o.is_active,
            s.enabled, s.entry_point, s.idp_issuer, s.idp_cert, s.email_attribute
       FROM organisations o
       LEFT JOIN org_sso s ON s.org_id = o.id
      WHERE o.slug = $1`,
    [slug]
  );
  if (r.rows.length === 0) return null;
  return rowToOrgWithSso(r.rows[0]);
}

export async function loadOrgSsoById(orgId: string): Promise<OrgWithSso | null> {
  const r = await query(
    `SELECT o.id, o.name, o.slug, o.is_active,
            s.enabled, s.entry_point, s.idp_issuer, s.idp_cert, s.email_attribute
       FROM organisations o
       LEFT JOIN org_sso s ON s.org_id = o.id
      WHERE o.id = $1`,
    [orgId]
  );
  if (r.rows.length === 0) return null;
  return rowToOrgWithSso(r.rows[0]);
}

function rowToOrgWithSso(row: Record<string, unknown>): OrgWithSso {
  // LEFT JOIN: when there's no org_sso row, enabled comes back null.
  const sso: OrgSsoRow | null =
    row.enabled === null || row.enabled === undefined
      ? null
      : {
          org_id: row.id as string,
          enabled: row.enabled as boolean,
          entry_point: (row.entry_point as string) ?? '',
          idp_issuer: (row.idp_issuer as string) ?? '',
          idp_cert: (row.idp_cert as string) ?? '',
          email_attribute: (row.email_attribute as string) ?? '',
        };
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    is_active: row.is_active as boolean,
    sso,
  };
}

// Strip PEM headers/whitespace so node-saml gets the bare base64 DER body it
// expects. Tolerant of admins pasting the full -----BEGIN CERTIFICATE----- block.
export function normaliseCert(cert: string): string {
  return (cert || '')
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '')
    .trim();
}

// True when the config has everything needed to actually run a login.
export function ssoIsUsable(sso: OrgSsoRow | null): sso is OrgSsoRow {
  return !!sso && sso.enabled && !!sso.entry_point && !!sso.idp_cert;
}

// Build a node-saml instance for a given org. Only call when ssoIsUsable() — the
// constructor requires idpCert and an entry point.
export function buildSaml(slug: string, sso: OrgSsoRow): SAML {
  return new SAML({
    callbackUrl: spCallbackUrl(slug),
    entryPoint: sso.entry_point,
    issuer: spEntityId(slug),
    idpCert: sso.idp_cert,
    audience: spEntityId(slug),
    wantAssertionsSigned: true,
    // Many IdPs sign the assertion but not the outer response; don't reject those.
    wantAuthnResponseSigned: false,
    acceptedClockSkewMs: 5000,
    // Let the IdP choose its NameID format rather than forcing emailAddress.
    identifierFormat: null,
  });
}

// Pull the user's email out of a validated assertion profile. Honours an
// explicit attribute mapping, then falls back to common claim shapes and the
// NameID when it looks like an email.
export function extractEmail(
  profile: Record<string, unknown> | null,
  emailAttribute: string
): string | null {
  if (!profile) return null;
  const pick = (v: unknown): string | null =>
    typeof v === 'string' && v.includes('@') ? v.toLowerCase() : null;

  if (emailAttribute && profile[emailAttribute]) {
    const mapped = pick(profile[emailAttribute]);
    if (mapped) return mapped;
  }
  const candidates = [
    profile.email,
    profile.mail,
    profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
    profile.nameID,
  ];
  for (const c of candidates) {
    const hit = pick(c);
    if (hit) return hit;
  }
  return null;
}

// Upsert a tenant's SSO config. Caller is responsible for authorisation.
export async function upsertOrgSso(
  orgId: string,
  f: { enabled: boolean; entryPoint: string; idpIssuer: string; idpCert: string; emailAttribute: string }
): Promise<OrgSsoRow> {
  const r = await query(
    `INSERT INTO org_sso (org_id, enabled, entry_point, idp_issuer, idp_cert, email_attribute, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (org_id) DO UPDATE SET
       enabled = $2, entry_point = $3, idp_issuer = $4, idp_cert = $5,
       email_attribute = $6, updated_at = NOW()
     RETURNING org_id, enabled, entry_point, idp_issuer, idp_cert, email_attribute`,
    [orgId, f.enabled, f.entryPoint, f.idpIssuer, f.idpCert, f.emailAttribute]
  );
  return r.rows[0];
}

// Client-facing DTO: camelCase config plus the SP coordinates a partner needs to
// register the platform in their IdP.
export function ssoConfigDto(slug: string, sso: OrgSsoRow | null) {
  return {
    enabled: sso?.enabled ?? false,
    entryPoint: sso?.entry_point ?? '',
    idpIssuer: sso?.idp_issuer ?? '',
    idpCert: sso?.idp_cert ?? '',
    emailAttribute: sso?.email_attribute ?? '',
    sp: {
      entityId: spEntityId(slug),
      acsUrl: spCallbackUrl(slug),
      loginUrl: spLoginUrl(slug),
      metadataUrl: spEntityId(slug),
    },
  };
}

// Hand-rolled SP metadata XML. Built without node-saml so it works even before
// an IdP cert has been supplied (partners need our entityID + ACS URL first to
// set us up on their side — a chicken-and-egg the SDK's builder can't serve).
export function spMetadataXml(slug: string): string {
  const entityId = spEntityId(slug);
  const acsUrl = spCallbackUrl(slug);
  return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService index="0" isDefault="true" Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
}
