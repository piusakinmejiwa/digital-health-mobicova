# HMO Product Roadmap — what HMOs need from the platform

Now that HMOs are a first-class tenant tier (see `docs/ORG-HIERARCHY-DESIGN.md`), this
maps what an HMO wants when it **joins and brings its book**, and what it wants to **see
day-to-day** — against what's already built. Status: ✅ built · 🟡 partial · ⚠️ gap.

Context: a Nigerian HMO is NHIA-regulated, manages corporate + retail health plans, runs a
provider network (hospitals/clinics/pharmacies), adjudicates and pays claims, and reports
to both its corporate clients and the regulator/insurer.

---

## 1. The onboarding moment — "I'm bringing my book"

An HMO arrives with **thousands of members across dozens of companies, already covered.**
The migration experience is make-or-break for adoption.

| Need | Status | Note |
|---|---|---|
| **Bulk-migrate the book** — import companies *and* their member rosters at scale (CSV), not one-by-one | ⚠️ **Biggest gap** | Per-org member CSV import exists; no HMO-level "onboard N companies + rosters" flow |
| Map existing **plans + per-company benefit tables** | 🟡 | Plan ownership + assignments exist; benefits are a simple list, not rich per-company customization |
| **Reconciliation** — "did all 5,000 land? how many active?" | 🟡 | Dashboard shows counts; no explicit import-reconciliation view |
| **Go live for members** — join codes, WhatsApp/USSD, branded portal | ✅ | Channels + branding built |

---

## 2. Day-to-day — the HMO's operational cockpit

| What HMOs run their business on | Status | Note |
|---|---|---|
| **Whole-book dashboard** — lives covered, active vs lapsed, growth across all employers | ✅ | Coverage-chain dashboard; could deepen: loss ratio, per-employer breakdown, trends |
| **Claims queue + adjudication + fraud flags** — the core job | ✅ | decide/approve/pay + AI review; could add SLA/turnaround + per-provider views |
| **Financials** — premium collected, their margin, loss ratio, outstanding | 🟡 | Premium + HMO margin + monthly loss ratio exist; no dedicated financial/remittance view |
| **Per-client utilization reports to hand to corporate clients** | ✅ | Scheduled branded reports — a retention/upsell tool |
| **Provider network** — manage the panel, utilization by hospital/pharmacy | ⚠️ | Supply orgs/providers exist; no HMO-facing "my network + utilization" |
| **Member engagement proof** — telemedicine, triage, rewards, WhatsApp/USSD usage | ✅ | The differentiator — basic-phone member access most HMO platforms lack |
| **White-label** — members see the HMO's brand | ✅ | Org branding |
| **Renewals & billing** — renewal dates, invoicing employers, remittance to the insurer | ⚠️ | Gap |
| **NHIA / regulatory** — encounter-data exports, in-Nigeria residency | 🟡 | Residency via Nobus; NHIA reporting a gap |

---

## 3. Priorities (for HMO adoption + retention)

**Tier 1 — land the HMO (adoption blockers):**
1. **Bulk book onboarding** — an HMO-level import: companies + rosters + plan mapping, with a
   reconciliation view. *If bringing their book is painful, they won't switch.*

**Tier 2 — run their business (retention):**
2. **Provider network + utilization** — panel management + "which hospitals/pharmacies cost me
   most". HMOs live on their network.
3. **HMO financial view** — loss ratio, premium in/outstanding, their margin, remittance to the
   insurer — the numbers they're judged on.

**Tier 3 — depth (nice-to-have):**
4. Per-company benefit-table customization; claims SLA/turnaround + per-provider analytics;
   renewals & employer invoicing; NHIA encounter-data export.

---

## Strategic read

You've built the **structure** (the hierarchy) and the **member-facing magic** (WhatsApp/USSD
access, telemedicine, AI triage/claims review, white-label). The remaining gap is the HMO's own
**operational cockpit** — bulk onboarding, provider network, financials — the back-office
capability that makes an HMO's team choose you and stay.

Sequencing note: tackle **bulk onboarding first** — it's the adoption gate. Provider network and
financials follow as the retention layer.
