# MobiCova Health — Incident Runbook (one page)

> Fill the **[bracketed]** placeholders once, then pin this. Designed for a solo operator
> to act fast at 3am. Targets: **RPO ≤ 5 min, RTO ≤ 30 min.**

**Quick links:** Render `[dashboard URL]` · Supabase `[URL]` · Cloudflare `[URL]` · Sentry `[URL]` · Uptime/Better Stack `[URL]` · Status page `[URL]`
**On-call:** `[you + phone]` · Backup: `[DevOps/contractor + phone]`

## Severity
| Level | Meaning | Respond |
|-------|---------|---------|
| **SEV1** | Platform down or data at risk | **Now** |
| **SEV2** | Major feature broken (payments, OTP, a channel) | ≤ 30 min |
| **SEV3** | Minor / degraded | Next business day |

## First 5 minutes (triage)
1. **Scope it** — is `https://api.<domain>/health` up? Which channel/feature? Top issue in **Sentry**?
2. **Recent change?** — Render → Events: did a deploy just go out? **If yes → roll back first, diagnose after.**
3. **Dependencies** — check status of Supabase, Render, Cloudflare, Meta (WhatsApp), Paystack/Stripe.
4. **Communicate** — note it in `[internal channel]`; if customer-facing, update the status page.

## Common incidents → first action
- **API down (`/health` failing)** → Render logs. Recent deploy? **Roll back.** Else restart/redeploy the service; if DB-related, see Restore.
- **DB errors / timeouts** → Supabase DB health. Confirm `DATABASE_URL` uses the **IPv4 pooler**. Connections exhausted? Restart API. Data corruption? **PITR restore.**
- **Bad deploy** → Render → Deploys → **Rollback** to last healthy (or re-run `release.yml` on the previous tag).
- **Auth to a vendor failing (401s to Stripe/WhatsApp/Anthropic)** → a key expired/rotated. Set the correct **live key** in Render env → redeploy.
- **Payments failing** → Stripe/Paystack dashboard + webhook deliveries; verify `STRIPE_WEBHOOK_SECRET`; replay failed webhooks.
- **WhatsApp / USSD not enrolling** → is the Meta / Africa's Talking webhook reachable? Inbound logs? `join_code` set on the org? `WHATSAPP_TOKEN` not expired?
- **High error rate / latency** → Sentry top issue. Load-driven? Confirm Render autoscaled; bump min instances. Else isolate the slow endpoint/query.

## Rollback (fastest recovery)
1. Render → service → **Deploys → Rollback** to the last healthy release (or re-run `release.yml` on the prior `vX.Y` tag).
2. Verify `/health` 200 + one smoke path (login).
3. If a **migration** caused it, go to Restore.

## Database restore (Supabase PITR)
1. Supabase → Database → **Backups / PITR** → restore to a point **just before** the incident (restore to a *new* project/branch first if unsure).
2. If restored to a new instance, repoint `DATABASE_URL` (IPv4 pooler) in Render → redeploy.
3. Validate a few records, then resume traffic.

## After resolution
- Confirm **green across all channels** (web, WhatsApp, USSD, payments, OTP).
- Log 3 lines in the incident log `[link]`: **what happened · root cause · fix**.
- File one follow-up action to prevent recurrence.

## Escalation
SEV1 unresolved in **[30] min** → call: `[DevOps engineer/contractor]` · `[Render support]` · `[Supabase support]` · `[affected partner contact]`.
