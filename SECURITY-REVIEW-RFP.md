# Security Review — Request for Proposal (Scope)

> Send this to 2–3 vendors for comparable quotes. Fill the **[bracketed]** fields; keep
> credentials and exact URLs out of this document — share those privately after NDA.

## 1. About the engagement
**[Company]** operates **MobiCova Health**, a B2B digital-health platform (Nigeria/Africa).
Partner organisations (insurers, employers, telcos, clinics, pharmacies) enrol members who
access telemedicine, an AI health assistant and health-linked insurance via web, **WhatsApp**
and **USSD**. The platform handles **personal health information and payment flows**, so we
are commissioning an independent **penetration test + cloud configuration review** ahead of
production launch.

- **Stack:** React (Vite) SPA · Node/Express (TypeScript) REST API · PostgreSQL (Supabase) ·
  hosted on Render, fronted by Cloudflare (WAF/CDN).
- **Architecture note:** multi-tenant — every organisation's data is isolated by `org_id`.
  There are **three authentication domains**: staff/partner admin, member (OTP), and provider
  (clinician/pharmacist).

## 2. Objectives
1. Identify exploitable vulnerabilities in the web app and API before go-live.
2. **Verify tenant isolation** — confirm one organisation cannot read or affect another's data.
3. Validate authentication/authorisation across all three login domains.
4. Surface cloud/config misconfigurations (Render, Supabase, Cloudflare).
5. Provide prioritised, actionable remediation we can fix and have **retested**.

## 3. In scope
- **Web application** (admin console, member portal, provider portal) — `[staging URL]`
- **REST API** (incl. the public API with API keys + webhooks) — `[api staging URL]`
- **Authentication & session handling** across staff / member-OTP / provider domains
- **Multi-tenant authorisation** — `org_id` isolation, role-based access, the supply-org "privacy slice"
- **Sensitive flows** — member enrolment + membership IDs, OTP delivery/verification,
  payment initiation (Stripe/Paystack), claims, file upload/storage
- **Channel intake** — WhatsApp & USSD webhook endpoints (input handling, auth of inbound)
- **Cloud configuration review** — Render services/secrets, Supabase (RLS/keys/exposure),
  Cloudflare (WAF, TLS, headers, rate limiting)

## 4. Out of scope (unless quoted separately)
- Denial-of-service / volumetric load testing
- Physical, social-engineering or phishing campaigns
- Third-party providers themselves (Meta/WhatsApp, Paystack/Stripe, Anthropic, Resend)
- Source-code audit *(optional add-on — please price separately if offered)*

## 5. Approach & environment
- **Grey-box** preferred: we provide **test accounts** for each role/domain and brief
  architecture notes, so testers spend time on logic flaws rather than recon.
- Test against a **production-like staging environment** (not live member data). Specify any
  checks you would additionally want against production (read-only) and how you'd de-risk them.
- Methodology aligned to **OWASP ASVS / Top 10** and **API Security Top 10**.

## 6. Deliverables
- Executive summary (business-readable) + technical findings.
- Each finding: severity (CVSS), evidence/repro steps, business impact, remediation.
- A prioritised remediation list.
- **One free retest** after we fix, with an updated/clearance report.
- A report format suitable to share with partners and to support a future **SOC 2 / ISO 27001**
  audit. *(We intend to pursue SOC 2 — note if you also provide that.)*

## 7. Compliance context
- **NDPR** (Nigeria Data Protection) applies; data is health-related PII.
- Currently EU-hosted (managed), migrating to AWS af-south-1 later. Flag any residency concerns.

## 8. Tester requirements
- Firm/testers with recognised accreditation — **CREST**, and/or testers holding **OSCP/OSWE**.
- Demonstrable experience testing **health-tech or fintech** applications.
- **Two references** from comparable engagements.
- NDA and a clear **data-handling policy** for any data accessed during testing.

## 9. Commercials & response
Please provide:
- **Fixed price** for sections 3 (test + cloud review) and 6 (incl. the retest); add-ons priced separately.
- Estimated **effort (person-days)** and **calendar timeline** (we are targeting `[window]`).
- Proposed **testing window** and rules of engagement.
- Team bios + accreditations + the two references.

**Respond by [date]** to **[name, email]**. We expect to award within **[X]** business days.

## 10. What we will provide on award
- Test accounts for each role/domain · staging URLs · brief architecture/data-flow notes ·
  a named technical contact · an agreed comms channel for live findings (e.g. critical issues
  reported immediately, not held for the report).
