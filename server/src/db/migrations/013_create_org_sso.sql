-- Per-tenant SAML single sign-on configuration. One row per organisation that
-- has (or is configuring) SSO with their own identity provider (Okta, Azure AD,
-- Google Workspace, etc.). The platform is the SAML Service Provider; the
-- partner's IdP issues the assertions.
--
-- Provisioning policy: pre-existing users only. SSO authenticates a user whose
-- email already maps to a row in `users` for this org; unknown emails are
-- rejected (no just-in-time account creation).
CREATE TABLE IF NOT EXISTS org_sso (
    org_id          UUID PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
    -- Master switch. When false, the org's /auth/saml/:slug/login endpoint is
    -- inert and password login remains the only path.
    enabled         BOOLEAN NOT NULL DEFAULT false,
    -- IdP SSO endpoint we redirect the browser to (the AuthnRequest target).
    entry_point     TEXT NOT NULL DEFAULT '',
    -- Expected IdP entityID/issuer (optional; informational + future validation).
    idp_issuer      TEXT NOT NULL DEFAULT '',
    -- IdP token-signing certificate (base64 DER body, PEM headers stripped on save).
    idp_cert        TEXT NOT NULL DEFAULT '',
    -- SAML attribute holding the user's email. Blank => use the assertion NameID.
    email_attribute TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
