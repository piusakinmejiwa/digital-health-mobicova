# Partner Distribution API

Lets a distribution channel — **PalmPay, OPay, Moniepoint, a telco wallet, or an
aggregator** — sell and service an underwriter's MobiCova-powered plans
programmatically. The channel is the storefront + premium-collection rail; the
underwriter (e.g. AXA Mansard) is the risk carrier; MobiCova is the servicing
layer (member record, telemedicine, claims, USSD/WhatsApp).

- **Base URL:** `{API}/api/partner/v1`
- **Auth:** `Authorization: Bearer mk_dist_…` (or `X-API-Key: mk_dist_…`). The key
  resolves the partner **and** the underwriter org whose plans it may sell; every
  request is scoped to that org and to plans underwritten by it.
- **Migration:** `068_distribution_partners.sql` (paste edition in `server/src/db/sql/`).

> Status: **scaffold / MVP**. Endpoint shapes are stable enough to integrate
> against; premium **rating** (dependants, riders) and **settlement/reconciliation**
> are intentionally minimal and plug in behind the same contract.

## Provision a partner (platform admin)

Behind the platform-admin Admin API (`/api/v1/admin/*`, requires a platform-admin token):

```bash
# Create — apiKey + webhookSecret are returned ONCE.
curl -X POST {API}/api/v1/admin/distribution-partners \
  -H "Authorization: Bearer <platform-admin-jwt>" -H "Content-Type: application/json" \
  -d '{ "orgId": "<axa-org-id>", "name": "PalmPay", "slug": "palmpay",
        "webhookUrl": "https://api.palmpay.com/mobicova/webhooks",
        "commissionRate": 15, "sandbox": true }'

# List · rotate key · toggle sandbox/active
GET   /api/v1/admin/distribution-partners
POST  /api/v1/admin/distribution-partners/:id/rotate-key
PATCH /api/v1/admin/distribution-partners/:id      { "sandbox": false }   # go live
```

`sandbox: true` flags every enrolment as a test (no real cover); flip to `false` to go live.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET  | `/products` | Plans this partner may sell (active + underwritten by its org). |
| POST | `/quote` | Price a plan for a prospective member. |
| POST | `/enrolments` | **Bind** — create the member + a pending policy. Idempotent on `externalRef`. |
| POST | `/enrolments/:id/payment` | Confirm premium collected → activate the policy. |
| GET  | `/enrolments/:id` | Policy + cover status (for the partner's "my insurance" view). |
| POST | `/enrolments/:id/cancel` | Cancel / lapse the policy. |

### Typical flow

```bash
# 1) Show products
curl {API}/api/partner/v1/products -H "Authorization: Bearer $KEY"

# 2) Quote
curl -X POST {API}/api/partner/v1/quote -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -d '{ "planId": "<plan-id>" }'

# 3) Bind — create member + pending policy (externalRef = PalmPay's order id)
curl -X POST {API}/api/partner/v1/enrolments -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -d '{
    "planId": "<plan-id>",
    "externalRef": "PP-ORDER-12345",
    "member": { "fullName": "Amaka Obi", "phone": "+2348012345678", "email": "amaka@example.com" }
  }'
# -> { enrolmentId, membershipId, status: "pending_payment", premium, currency, ... }

# 4) Confirm premium collected -> policy activates, ledger entry written, webhook fires
curl -X POST {API}/api/partner/v1/enrolments/<enrolmentId>/payment \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{ "amount": 2500, "externalTxnRef": "PP-TXN-98765" }'
# -> { enrolmentId, status: "active", ledgerId,
#      premium: { gross, commission, platformFee, net, ... } }
```

`amount` defaults to the bound premium if omitted. Each confirmed payment writes a
row to the **premium ledger** (gross → partner commission → MobiCova platform fee →
net to underwriter, rates snapshotted), idempotent on `externalTxnRef`. Roll-ups per
billing period are available to platform admins at
`GET /api/v1/admin/distribution-partners/:id/premiums`. See
[PARTNER-SETTLEMENT-DESIGN.md](PARTNER-SETTLEMENT-DESIGN.md).

`POST /enrolments` and `/payment` are **idempotent** — retrying with the same
`externalRef` (or re-confirming payment) returns the existing policy, so network
retries never create duplicates or double-charge.

## Webhooks (MobiCova → partner)

If the partner has a `webhookUrl`, MobiCova POSTs signed events to it:

- `policy.activated` — premium confirmed, cover live.
- `policy.cancelled` — policy cancelled/lapsed.
- `policy.expiring` — renewal due (roadmap).
- `claim.status_changed` — a claim on a partner-sourced policy changed (roadmap).

Signature (same scheme as tenant webhooks): header
`X-MobiCova-Signature: t=<ts>,v1=<hex>` where `hex = HMAC-SHA256(webhookSecret, "<ts>.<rawBody>")`.
Verify it before trusting the payload. Delivery is fire-and-forget, 5s timeout, no
redirects, and the target host is SSRF-checked (public addresses only).

## What's deliberately out of scope (next phases)

- **Rating engine** — real premium calculation (age bands, dependants, riders).
- **Settlement/reconciliation** — commission payout files, premium remittance, refunds, recurring renewals.
- **Admin UI** — a client tab to manage partners (today it's the Admin API above).
- **PalmPay field mapping** — map their live request/response spec onto this canonical contract when it lands.

## Regulatory / data notes

The product is sold under the **underwriter's NAICOM licence** (micro/embedded-insurance
framework); disclosures + commission caps apply. Member PII/PHI now flows
partner ↔ MobiCova ↔ underwriter — this needs **DPAs + point-of-sale consent** (NDPR/NDPC)
and ties into the data-residency work. PalmPay is CBN-licensed for premium collection.
