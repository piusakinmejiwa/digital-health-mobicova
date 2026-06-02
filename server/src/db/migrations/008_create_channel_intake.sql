-- Channel-based member intake (WhatsApp + USSD).
--
-- join_code: a short code a member types on WhatsApp/USSD so the platform knows
-- which partner organisation they are enrolling under. Numeric-friendly for USSD.
ALTER TABLE organisations
    ADD COLUMN IF NOT EXISTS join_code VARCHAR(12) DEFAULT '';

-- Backfill a 6-digit code for any organisation that doesn't have one yet.
UPDATE organisations
   SET join_code = lpad((floor(random() * 1000000))::int::text, 6, '0')
 WHERE join_code IS NULL OR join_code = '';

CREATE INDEX IF NOT EXISTS idx_orgs_join_code ON organisations(join_code);

-- Conversational state for stateful channels (WhatsApp). USSD is stateless and
-- replays the accumulated input each request, so it does not need a row here.
CREATE TABLE IF NOT EXISTS intake_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel     VARCHAR(20) NOT NULL,
    identifier  VARCHAR(60) NOT NULL,        -- phone number / WhatsApp id
    org_id      UUID REFERENCES organisations(id) ON DELETE CASCADE,
    step        VARCHAR(40) NOT NULL DEFAULT 'org_code',
    data        JSONB NOT NULL DEFAULT '{}', -- accumulated answers
    completed   BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intake_channel_ident ON intake_sessions(channel, identifier);
