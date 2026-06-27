# MobiCova — Domain & DNS Cutover Runbook

**Moving the platform onto `mobicovahealth.com`**

MobiCova Health · June 2026

---

## Goal

Put MobiCova on the new `mobicovahealth.com` domain with a dedicated, production-grade host for the API. Run the phases **in order** — config and webhooks depend on the domain resolving first.

## Target architecture

| Hostname | Points to (Render service) | Serves |
|---|---|---|
| `mobicovahealth.com` + `www.mobicovahealth.com` | `mobicova-client` (frontend) | Website + member app + staff dashboard |
| `api.mobicovahealth.com` | `mobicova-api` (backend) | The API — the callback/webhook host |

After cutover: members log in at `https://mobicovahealth.com/member/login`; the API lives at `https://api.mobicovahealth.com`.

---

## Phase 1 — Add the custom domains in Render

1. **`mobicova-api` → Settings → Custom Domains → Add** `api.mobicovahealth.com`. Render displays a **CNAME target** (e.g. `mobicova-api.onrender.com`). Note it.
2. **`mobicova-client` → Settings → Custom Domains → Add** both `mobicovahealth.com` and `www.mobicovahealth.com`. Render displays the records to create (apex = an **A** or **ALIAS** record to Render's IP; `www` = a **CNAME**). Note them.

## Phase 2 — Create the DNS records

At your domain registrar / DNS provider for `mobicovahealth.com`, add exactly what Render showed:

| Record | Type | Value |
|---|---|---|
| `api` | CNAME | the target Render gave for the API |
| `www` | CNAME | the target Render gave for the frontend |
| `@` (apex) | A / ALIAS | the value Render gave for the apex |

Use a low TTL (e.g. 300s) during cutover so changes apply quickly.

## Phase 3 — Verify DNS + SSL

- Wait for propagation (minutes to a few hours).
- Render **auto-issues SSL** (Let's Encrypt) once it verifies each domain — watch each domain go to "Verified / Certificate issued".
- Quick check: `https://api.mobicovahealth.com/health` returns the JSON health payload, and `https://mobicovahealth.com` loads the site — both over HTTPS with a valid padlock.

## Phase 4 — Update application config

1. **`mobicova-client`** env `VITE_API_URL` = `https://api.mobicovahealth.com/api/v1` → redeploy (a Vite var is baked in at build time, so a **rebuild is required**).
2. **`mobicova-api`** env `CLIENT_URL` = `https://mobicovahealth.com,https://www.mobicovahealth.com` → redeploy. This fixes **CORS** and the base URL used in **OTP / email links**.

## Phase 5 — Repoint every webhook & callback to the new API host

| Integration | New URL |
|---|---|
| Africa's Talking — USSD | `https://api.mobicovahealth.com/api/v1/channels/ussd` |
| Africa's Talking — USSD events | `https://api.mobicovahealth.com/api/v1/channels/ussd/notification` |
| Meta WhatsApp — webhook | `https://api.mobicovahealth.com/api/v1/channels/whatsapp/webhook` |
| PharmaRun — webhook | `https://api.mobicovahealth.com/api/v1/pharmarun/webhook` |
| Stripe — webhook | `https://api.mobicovahealth.com/api/v1/billing/stripe/webhook` |
| Paystack — webhook | `https://api.mobicovahealth.com/api/v1/billing/paystack/webhook` |

*(WhatsApp's webhook needs re-verification after the URL change — keep the same `WHATSAPP_VERIFY_TOKEN`.)*

## Phase 5b — Hardcoded host references in the repo (commit these)

These are baked into shipped files (not env-driven), so they need a code change + redeploy. Update them to the new API host as part of the cutover:

| File | What to change |
|---|---|
| `client/public/openapi.json` | "Production" server URL → `https://api.mobicovahealth.com/api/public/v1` (and contact URL → `https://mobicovahealth.com`) — partners read this |
| `client/public/robots.txt` | `Sitemap:` URL → `https://api.mobicovahealth.com/api/v1/blog/sitemap.xml` — SEO |
| `client/src/pages/docs/DocsPage.tsx` | the `curl` example URL → the new API host — developer docs |
| `.github/workflows/daily-health-tips.yml` | set the `API_BASE_URL` repo secret to `https://api.mobicovahealth.com` (or update the fallback) — the daily-tips cron |

*Optional (branding, not breaking):* contact emails `support@ / sales@ / privacy@mobicova.com` could move to `@mobicovahealth.com` once email is set up on the new domain.

## Phase 6 — Smoke test

- [ ] `https://api.mobicovahealth.com/health` → 200, integrations as expected.
- [ ] `https://mobicovahealth.com` loads; no console CORS errors.
- [ ] Member login at `https://mobicovahealth.com/member/login` → OTP arrives → dashboard loads (proves CORS + `VITE_API_URL` + OTP links).
- [ ] Staff dashboard login works.
- [ ] USSD simulator against the new callback → member menu.
- [ ] One test webhook per live integration returns 200.

## Rollback

The old hosts keep working throughout (nothing is deleted), so rollback is low-risk:
1. Revert `VITE_API_URL` to `https://mobicova-api.onrender.com/api/v1` and `CLIENT_URL` to the previous value; redeploy.
2. Point integrations' callbacks back to the `mobicova-api.onrender.com` URLs.
3. DNS changes can stay — they don't break the old `.onrender.com` URLs.

## Old → new reference

| Old | New |
|---|---|
| `mobicova-api.onrender.com` | `api.mobicovahealth.com` |
| `digitalhealth.mobicova.com` (frontend) | `mobicovahealth.com` |

---

*MobiCova Health — production-ready, on your own domain.*
