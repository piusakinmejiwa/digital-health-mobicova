# MobiCova Health — Go-Live Checklist (launch day)

> Tick straight through. Maps to `MANAGED-GO-LIVE-PLAN.md`. Don't start the cutover until
> every **T-1 day** box is ticked.

## T-1 day — prepare
- [ ] Production **Supabase** project live; migrations applied; **PITR on**; a backup restore validated
- [ ] `DATABASE_URL` uses the **IPv4 pooler** string (direct host is IPv6-only)
- [ ] Render prod services build green — **API ≥2 instances**, `/health` returns 200
- [ ] All **live** secrets set in Render (Stripe/Paystack live, WhatsApp prod, Resend verified domain, Anthropic, `JWT_SECRET`, `CLIENT_URL`/`SERVER_URL`, `PLATFORM_ADMIN_EMAILS`)
- [ ] `OTP_DEV_MODE` and `DEMO_SEED_PASSWORD` are **NOT** set
- [ ] **Cloudflare** DNS staged (TTL lowered), **WAF** on, TLS **Full (strict)** + HSTS, security headers
- [ ] **Sentry** + **uptime monitor** + **paging** configured and test-fired
- [ ] GitHub `production` environment has **required reviewers**; prod deploy-hook secrets + `PROD_API_URL` set
- [ ] **Security review** done (or firmly booked)
- [ ] **MFA** on Render, Supabase, Cloudflare, GitHub
- [ ] `INCIDENT-RUNBOOK.md` filled in and pinned; rollback path confirmed

## Launch — cutover
- [ ] Tag release **`vX.Y`** → approve in GitHub → deploy → **smoke test green**
- [ ] Final migration applied; **real platform admin(s) seeded**; **NO demo data**
- [ ] Live **webhooks** pointed at `api.<domain>`: WhatsApp (Meta) · Africa's Talking (USSD/SMS) · Stripe/Paystack
- [ ] One **test payment + refund** succeeds; webhook received
- [ ] **DNS cutover** to production
- [ ] Smoke **every channel**: web login · WhatsApp enrol → membership ID · USSD enrol · OTP login · a claim

## First hours — watch
- [ ] Dashboards green: error rate flat, latency OK, DB healthy, autoscale behaving
- [ ] First **real enrolments** confirmed across channels
- [ ] No secret in logs; no 5xx spike
- [ ] Rollback stays one click away

## First week — settle
- [ ] **PITR restore test** to a clone/branch (prove RPO/RTO)
- [ ] **Cost + error** review
- [ ] Incident runbook finalised with real links + contacts
- [ ] **DevOps-engineer handover pack** ready (see `MANAGED-GO-LIVE-PLAN.md`)

---

**Go / No-Go gate:** proceed to cutover only if — backups verified · rollback ready · monitoring live · security review done · all live keys set · no demo data. Any unchecked → **hold**.
