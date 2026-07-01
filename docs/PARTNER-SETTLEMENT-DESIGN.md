# Partner Settlement & Reconciliation — design sketch

Companion to the [Partner Distribution API](PARTNER-DISTRIBUTION-API.md). This is a
**design proposal**, not built yet. It covers how MobiCova records premiums,
reconciles them against what a distribution partner (PalmPay, OPay, …) reports,
and produces the settlement statements AXA's finance team and the partner sign off.

## 1. MobiCova's role: system of record, not money mover

The cash moves **wallet → insurer** on rails MobiCova doesn't own. PalmPay debits
the user's wallet, keeps its commission, and remits net premium to the underwriter
(AXA). **MobiCova is the shared source of truth**: it records every premium event,
reconciles the two sides, and produces the statements both parties settle against.
It does not hold or move the premium (that keeps MobiCova out of the CBN
money-transmission perimeter and out of the insurer's licensed premium account).

```
 PalmPay user
     │  pays ₦2,500/mo from wallet
     ▼
  PalmPay ──── retains commission (₦375 @ 15%) ────────────────┐
     │                                                          │
     │  remits net premium (₦2,125)                             │
     ▼                                                          ▼
  AXA Mansard (underwriter) premium account          commission to PalmPay
     ▲
     │  "premium collected" event  (Partner Distribution API: POST /enrolments/:id/payment)
     │
  MobiCova ── premium ledger ── reconciliation ── settlement statement ──► AXA finance + PalmPay
```

Alternative (MobiCova/Paystack collects and split-pays the partner) is possible for
smaller channels, but for a wallet super-app the model above is standard — the doc
assumes it, with the collect-side abstracted so the other model plugs in later.

## 2. Principles

- **Append-only ledger.** Premium events are never edited; corrections are new
  reversing/adjustment entries. Full audit trail.
- **Exact decimals.** Money is `NUMERIC(14,2)` (Postgres exact decimal) — never
  floats. Consistent with `insurance_plans` / `enrolments`.
- **Idempotent ingest.** Each external transaction is unique per partner
  (`(partner_id, external_txn_ref)`), so retries and re-uploads never double-count.
- **Commission snapshot.** The rate in force at collection time is stored on the
  entry — later rate changes don't rewrite history.
- **Everything reconciles to a period.** A billing cycle (usually a calendar month,
  cut at a WAT boundary) is the unit of settlement.

## 3. Data model (proposed)

```sql
-- The premium ledger — one immutable row per money event.
CREATE TABLE premium_transactions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrolment_id       UUID REFERENCES enrolments(id),
    partner_id         UUID REFERENCES distribution_partners(id),
    org_id             UUID NOT NULL REFERENCES organisations(id),   -- underwriter
    plan_id            UUID REFERENCES insurance_plans(id),
    type               VARCHAR(20) NOT NULL,      -- premium | refund | chargeback | adjustment
    gross_amount       NUMERIC(14,2) NOT NULL,    -- what the member paid
    commission_rate    NUMERIC(5,2)  NOT NULL,    -- snapshot at collection
    commission_amount  NUMERIC(14,2) NOT NULL,    -- partner keeps
    levy_amount        NUMERIC(14,2) DEFAULT 0,   -- NAICOM/other statutory line
    net_amount         NUMERIC(14,2) NOT NULL,    -- due to the underwriter
    currency           VARCHAR(10) DEFAULT 'NGN',
    period             CHAR(7),                   -- 'YYYY-MM' billing cycle
    external_txn_ref   VARCHAR(160),              -- partner's transaction id
    status             VARCHAR(20) DEFAULT 'recorded', -- recorded | reconciled | disputed
    collected_at       TIMESTAMPTZ,
    created_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_premium_txn_partner_ref
    ON premium_transactions(partner_id, external_txn_ref) WHERE external_txn_ref IS NOT NULL;

-- A partner's own statement, ingested for matching (file upload or their API).
CREATE TABLE partner_settlement_files (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id   UUID REFERENCES distribution_partners(id),
    period       CHAR(7),
    row_count    INT, reported_gross NUMERIC(14,2),
    uploaded_at  TIMESTAMPTZ DEFAULT NOW()
);

-- A reconciliation pass + the discrepancies it found.
CREATE TABLE reconciliation_runs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id  UUID REFERENCES distribution_partners(id),
    period      CHAR(7),
    matched     INT, exceptions INT,
    our_gross   NUMERIC(14,2), their_gross NUMERIC(14,2),
    ran_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE reconciliation_exceptions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id      UUID REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
    kind        VARCHAR(30),   -- missing_ours | missing_theirs | amount_mismatch | duplicate
    external_txn_ref VARCHAR(160),
    our_amount  NUMERIC(14,2), their_amount NUMERIC(14,2),
    resolved    BOOLEAN DEFAULT false, note TEXT
);

-- The signed-off period summary per partner.
CREATE TABLE settlement_statements (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id        UUID REFERENCES distribution_partners(id),
    org_id            UUID REFERENCES organisations(id),
    period            CHAR(7),
    policies          INT,
    gross_premium     NUMERIC(14,2),
    commission_total  NUMERIC(14,2),
    levy_total        NUMERIC(14,2),
    net_to_underwriter NUMERIC(14,2),
    status            VARCHAR(20) DEFAULT 'draft', -- draft | finalised | paid
    generated_at      TIMESTAMPTZ DEFAULT NOW(),
    finalised_at      TIMESTAMPTZ
);
```

## 4. Lifecycles

- **Premium collected** — the existing `POST /enrolments/:id/payment` gains an
  amount + `external_txn_ref` and writes a `premium` ledger row (gross, commission
  snapshot, net). Idempotent on `(partner_id, external_txn_ref)`.
- **Renewal** — each monthly cycle is a *new* premium row against the same
  enrolment, tagged with its `period`. (Ties into the renewals engine.)
- **Refund / cancellation / chargeback** — a reversing `refund`/`chargeback` row
  (negative net), linked to the original by `external_txn_ref`.
- **Reconciliation run** — ingest the partner's statement → match by
  `external_txn_ref` (fallback: enrolment + amount + date) → record exceptions.
- **Settlement statement** — aggregate a period's reconciled rows into one
  statement; finalise; export CSV/PDF for AXA + PalmPay.

## 5. Reconciliation algorithm

Match MobiCova's ledger for the period against the partner's reported rows:

| Exception | Meaning | Typical cause |
|---|---|---|
| `missing_theirs` | we have it, partner didn't report | timing (their file lags), or a webhook we accepted that never cleared |
| `missing_ours` | partner reported, we have no policy | enrol call failed / dropped; or a sale outside our flow |
| `amount_mismatch` | same txn, different amount | fee/FX/rounding difference |
| `duplicate` | same `external_txn_ref` twice | retry not deduped upstream |

Each exception is worked to `resolved` with a note. A run isn't "green" until
`our_gross == their_gross` (net of documented, resolved exceptions).

## 6. Settlement math (worked example)

One ₦2,500 monthly premium, 15% commission, ₦0 statutory levy:

| Line | Amount |
|---|---|
| Gross premium (member paid) | ₦2,500.00 |
| Partner commission (15%) | ₦375.00 |
| Statutory levy | ₦0.00 |
| **Net due to underwriter** | **₦2,125.00** |

Period statement = the sum of these across all reconciled policies for the month:
`gross_premium`, `commission_total` (owed to / retained by partner),
`net_to_underwriter` (owed to AXA). A MobiCova platform fee, if any, is a further
line taken from either side per the commercial agreement.

## 7. Operator / API surface (proposed)

- **Partner → MobiCova:** `POST /payment` carries `amount` + `externalTxnRef`
  (extend the existing endpoint). Optional `POST /partner/v1/settlement/report`
  for a batch of collected txns.
- **Admin Console → Distribution → Settlement:** upload/ingest a partner statement
  file (CSV) *or* pull their settlement API; **Run reconciliation** → exceptions
  worklist; **Generate statement** → review → **Finalise** → export CSV/PDF.
- **Webhooks → partner:** `settlement.ready`, `reconciliation.exception_raised`.
- **Scheduled:** a monthly cron finalises the prior period and emails statements
  (reuses the reports/cron infra already in the platform).

## 8. Edge cases & controls

- Dedupe on `(partner_id, external_txn_ref)`; out-of-order + late rows land in the
  correct `period`, not "now".
- Partial / failed / reversed payments each get their own typed row.
- Multi-currency: `currency` per row; never mix currencies in one statement (per-country partners settle in their own currency).
- Period cut at a fixed WAT boundary; document the cutoff so both sides agree.
- Disputes: an exception stays open (statement can't finalise) until resolved with a note — full audit via the append-only ledger + the existing audit log.

## 9. Regulatory / finance notes

- **Premium remittance** to the insurer is time-bound under NAICOM rules — the
  reconciliation cadence and statement finalisation must fit AXA's remittance SLA.
- **Statutory levies / VAT** on premium or commission are explicit ledger lines,
  not baked into net — so finance can report them.
- AXA finance defines the **statement format + cutoff + tolerance** for a "clean"
  reconciliation; build to their spec.

## 10. Phased build

1. **Ledger** — `premium_transactions` + extend `POST /payment` to write it (small,
   unlocks reporting immediately).
2. **Reconciliation** — statement ingest (CSV) + matching + exceptions worklist.
3. **Statements** — period aggregation + finalise + CSV/PDF export + the admin
   Settlement sub-tab.
4. **Automation** — scheduled monthly finalisation, `settlement.ready` webhooks,
   a reconciliation dashboard, renewals feeding the ledger.

Hooks cleanly onto what exists: `distribution_partners`, `enrolments.external_ref`,
the `/payment` endpoint, the webhook infra, and the reports/cron scheduler.
