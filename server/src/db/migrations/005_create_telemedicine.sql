-- Telemedicine consultations. The clinical service is delivered by an MDCN-licensed
-- telemedicine partner; MobiCova provides the channel, scheduling, and record.
CREATE TABLE consultations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    member_id     UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    partner_id    UUID REFERENCES partners(id),
    mode          VARCHAR(20) DEFAULT 'video',
    channel       VARCHAR(20) DEFAULT 'app',
    reason        TEXT DEFAULT '',
    scheduled_at  TIMESTAMPTZ,
    status        VARCHAR(30) DEFAULT 'scheduled',
    doctor_name   VARCHAR(255) DEFAULT '',
    notes         TEXT DEFAULT '',
    diagnosis     TEXT DEFAULT '',
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_consultations_org ON consultations(org_id);
CREATE INDEX idx_consultations_member ON consultations(member_id);

-- e-Prescriptions issued during a consultation, fulfilled by a pharmacy partner.
CREATE TABLE prescriptions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id  UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    member_id        UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    medication       VARCHAR(255) NOT NULL,
    dosage           VARCHAR(120) DEFAULT '',
    instructions     TEXT DEFAULT '',
    pharmacy_partner VARCHAR(255) DEFAULT '',
    fulfilment_status VARCHAR(30) DEFAULT 'pending',
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prescriptions_member ON prescriptions(member_id);
