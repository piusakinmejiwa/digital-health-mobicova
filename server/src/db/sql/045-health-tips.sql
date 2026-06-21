-- =====================================================================
-- 045 · Daily Health Tips — paste edition
-- Run once in the Supabase SQL Editor (identical to the numbered migration
-- server/src/db/migrations/045_health_tips.sql, plus the _migrations marker).
-- =====================================================================

CREATE TABLE IF NOT EXISTS health_tip_subscribers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name         VARCHAR(160) NOT NULL DEFAULT '',
    sms_number        VARCHAR(40)  NOT NULL DEFAULT '',
    whatsapp_number   VARCHAR(40)  NOT NULL DEFAULT '',
    email             VARCHAR(255) NOT NULL DEFAULT '',
    channels          TEXT[]       NOT NULL DEFAULT '{}',
    consent           BOOLEAN      NOT NULL DEFAULT false,
    is_active         BOOLEAN      NOT NULL DEFAULT true,
    unsubscribe_token UUID         NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health_tips (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seq        SERIAL,
    title      VARCHAR(160) NOT NULL DEFAULT '',
    body       TEXT NOT NULL DEFAULT '',
    category   VARCHAR(60) NOT NULL DEFAULT 'general',
    is_active  BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health_tip_sends (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id UUID NOT NULL REFERENCES health_tip_subscribers(id) ON DELETE CASCADE,
    tip_id        UUID REFERENCES health_tips(id) ON DELETE SET NULL,
    channel       VARCHAR(20) NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'sent',
    error         TEXT NOT NULL DEFAULT '',
    sent_on       DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (subscriber_id, channel, sent_on)
);
CREATE INDEX IF NOT EXISTS idx_health_tip_sends_sub ON health_tip_sends(subscriber_id);

INSERT INTO health_tips (title, body, category) VALUES
('Stay hydrated', 'Aim for 6–8 glasses of clean water a day. Carry a bottle and sip regularly — thirst is a late sign you are already low on fluids.', 'general'),
('Move every day', 'A brisk 30-minute walk most days lowers your risk of heart disease and diabetes. Short on time? Three 10-minute walks count too.', 'fitness'),
('Wash your hands', 'Wash with soap for 20 seconds before eating and after the toilet. It is one of the cheapest, most effective ways to prevent infection.', 'hygiene'),
('Check your blood pressure', 'High blood pressure often has no symptoms. If you are over 40 or have a family history, get it checked regularly.', 'prevention'),
('Eat the rainbow', 'Fill half your plate with vegetables and fruit of different colours. Variety gives you a wider range of vitamins and fibre.', 'nutrition'),
('Protect your sleep', 'Adults need 7–9 hours. Keep a regular bedtime and put your phone away 30 minutes before sleep for better rest.', 'wellbeing'),
('Know the malaria signs', 'Fever, chills, headache and body aches can signal malaria. Seek a test early — do not self-treat with leftover medicine.', 'prevention'),
('Take medicines as prescribed', 'Finish the full course of antibiotics even if you feel better, and never share prescription medicine with others.', 'safety')
ON CONFLICT DO NOTHING;

INSERT INTO _migrations (name) VALUES ('045_health_tips.sql')
ON CONFLICT (name) DO NOTHING;
