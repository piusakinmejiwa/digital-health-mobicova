# MobiCova — Backlog

Things deliberately deferred. **Nothing here is broken** — the platform (Q1–Q10) and the full
8-feature design package (Phases 1–4) are built, verified, and deployed. This is the "next, when we
choose to" list.

_Last updated: 2026-06-04._

---

## Pending operational steps (on the owner, not code)

- [ ] **Custom domain `digitalhealth.mobicova.com`** — DNS not yet cut over:
  1. Add a **CNAME** at the DNS host: `digitalhealth` → the `…onrender.com` target Render shows.
  2. Render → **mobicova-client** → Settings → **Custom Domains** → add `digitalhealth.mobicova.com`.
  3. Render → **mobicova-api** → Environment → set
     `CLIENT_URL=https://digitalhealth.mobicova.com,https://mobicova-client.onrender.com`,
     then manual-deploy the API. (Multi-origin CORS already supports the comma-separated list.)
- [ ] **Confirm Phase 4 is live in prod** — push + `npm run migrate` (applies `020–022`) so the
  marketing site, branding, inbox and demo-leads tables are on production.
- [ ] **Demo admin has 2FA enabled** — keep the authenticator handy for live demos, or turn 2FA off
  on `admin@axamansard.demo` (Security page) before a pitch.

---

## Optional feature enhancements

### Provider provisioning in the Admin Console
Providers (doctors/pharmacists) are currently **seed-only** (`npm run seed`). Add CRUD so platform/
partner admins can create, edit, deactivate and reset providers from the Admin Console — mirroring the
existing Users tab. Table already exists (`providers`, migration `018`).

### Logo file upload for branding
Branding currently uses a **letter-mark + colour pair** (`/settings/branding`). Add real logo image
upload, reusing the existing **Supabase Storage** pattern from claim documents (`config/storage.ts`).
The member portal/WhatsApp/member-card would then render the uploaded logo instead of the letter.

### Real recurring billing (Paystack)
The Billing page (`/settings/billing`) is **demo-grade**: plan changes switch the org's tier directly
and invoices are representative. Wire upgrades through the existing Paystack/Stripe checkout, add a
subscription/billing-cycle model, and generate real invoices. Usage meters are already real.

### Admin view of demo leads
Marketing "Book a demo" submissions are captured in `demo_leads` (migration `022`) but not surfaced.
Add a simple admin/platform-admin list (and optional CSV export) so sales can work the pipeline.

### Member self-booking of consultations
Today consultations are created by partner staff (`bookConsultation`). The member app's Care tab
explains that consults are arranged by the provider. Could add a member-initiated request that lands
in the partner/provider queue.

### Saved analytics reports
The analytics query builder (`/analytics`) recomputes live but doesn't persist saved reports. Add a
`saved_reports` table + UI to name and reload `{ measure, dimension, filters }` (the design's
"Save as report").

---

## Technical / housekeeping

- [ ] **Bundle splitting** — the client build warns about a >500 KB JS chunk. Cosmetic; could be
  improved with route-level `React.lazy()` code-splitting or `manualChunks` (e.g. split out recharts).
- [ ] **DATABASE_CA_CERT in production** — currently the DB connection is encrypted but the cert is
  not verified (managed-Postgres default). Supplying the CA cert pins it (defence-in-depth).
- [ ] **Member read-state for inbox** — `inbox_reads` is per-org; consider per-user if multiple
  staff shouldn't share the "read" state.
- [ ] **OTP / lead delivery** — member OTP and demo leads currently surface on screen / store only.
  Wire a real SMS/WhatsApp gateway (OTP) and CRM/email (leads) when available; turn off `OTP_DEV_MODE`.

---

## Done (for reference)

- ✅ Q1–Q10 platform (audit, roles, SSO, 2FA, bulk import, claims, analytics, public API + webhooks,
  provider portal, member portal).
- ✅ Phases 1–4 design package (onboarding, ⌘K + help, member-app polish, billing, branding,
  analytics builder, inbox, API console, docs, marketing site).
- ✅ Multi-origin CORS, combined 31-test manual UAT script (`TEST-SCRIPT.md`/`.docx`), smoke test
  (`smoke-test.ps1`) covering core + SaaS features (48/48 passing).
