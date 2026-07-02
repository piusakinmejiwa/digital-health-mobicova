# Slack notifications (per-tenant)

An organisation can connect one Slack **Incoming Webhook** and MobiCova posts a
**PHI-safe** headline + deep link for the notification categories they enable —
the same categories that drive the in-app bell and email.

## Connect (org admin)
1. In Slack: **Apps → Incoming Webhooks → Add to Workspace**, pick the channel, copy the URL (`https://hooks.slack.com/services/T…/B…/…`).
2. In MobiCova: **Settings → Notifications → Slack** → paste the URL, tick the categories, **Save**, then **Send test**.
3. Pause anytime with the master switch, or **Disconnect** to remove the webhook.

## What gets posted — and what doesn't
- Posted: the notification **title** (e.g. *"New claim submitted"*, *"N members imported"*) + an **Open in MobiCova** link.
- **Never posted:** the notification body, member names, or any PHI. Slack is a
  third-party service and a cross-border data flow — detail stays in-app behind auth.

## How it works
- Table `org_slack` (migration 070): `webhook_url`, `active`, `categories[]` per org.
- `lib/slack.ts` — URL validation (only `https://hooks.slack.com/services/…`),
  SSRF-guarded POST (public host, no redirects, 5s timeout), and `emitSlack()`.
- `notify()` calls `emitSlack(orgId, category, title, href)` after the in-app
  insert (post-dedupe), independent of the email provider.
- Endpoints (`/notifications/slack`): `GET` (any user; URL returned masked),
  `PUT` + `POST /test` (admin only). The webhook URL is a secret — only a masked
  hint is ever returned to the client.

## Notes
- Slack rate-limits incoming webhooks (~1 msg/sec); high-volume categories may be
  throttled by Slack — fine for the operational events here.
- Requires **migration 070** applied.
