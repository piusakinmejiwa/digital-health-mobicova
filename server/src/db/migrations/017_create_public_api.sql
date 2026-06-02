-- Q8: Public REST API + webhooks, so insurers can integrate MobiCova with their
-- core policy/claims systems.

-- Per-organisation API keys. The full key is shown once at creation; we store
-- only a SHA-256 hash plus a short, non-secret prefix for identification in the
-- UI and for fast lookup at auth time.
CREATE TABLE IF NOT EXISTS api_keys (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name         VARCHAR(120) NOT NULL DEFAULT '',
    key_prefix   VARCHAR(24) NOT NULL,          -- e.g. mk_live_3f9a2b (display + lookup)
    key_hash     TEXT NOT NULL,                 -- sha256 hex of the full key
    last_used_at TIMESTAMPTZ,
    created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    revoked      BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);

-- Outbound webhook endpoints a partner registers. Each has its own signing
-- secret; events[] is the subscription filter (empty = all events).
CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    url        TEXT NOT NULL,
    secret     TEXT NOT NULL,                   -- HMAC signing secret (whsec_…)
    events     TEXT[] NOT NULL DEFAULT '{}',
    active     BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org ON webhook_endpoints(org_id);

-- Lightweight delivery log for observability (the partner can see recent
-- attempts and status codes). Best-effort; not a guaranteed-delivery queue.
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    event       VARCHAR(60) NOT NULL,
    status_code INT,
    success     BOOLEAN NOT NULL DEFAULT false,
    error       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint
    ON webhook_deliveries(endpoint_id, created_at DESC);
