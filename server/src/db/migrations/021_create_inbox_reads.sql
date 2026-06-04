-- Phase 3: Inbox / Action centre. Inbox items are DERIVED from business rules
-- (overdue claims, failing webhooks, unpaid enrolments…), so the only stored
-- state is which derived item a tenant has marked read, keyed by a stable item id.
CREATE TABLE IF NOT EXISTS inbox_reads (
    org_id   UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    item_key VARCHAR(160) NOT NULL,
    read_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (org_id, item_key)
);
