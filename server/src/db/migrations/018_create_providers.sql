-- Q9: Provider portal — a separate login for the clinicians and pharmacists who
-- staff MobiCova's partner organisations (telemedicine clinics, pharmacy
-- networks). They accept consults and fulfil e-prescriptions.
--
-- A provider belongs to a partner (the licensed entity). Auth is password-based
-- and provisioned by the platform — there is no provider self-signup.
CREATE TABLE IF NOT EXISTS providers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id    UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    full_name     VARCHAR(255) NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          VARCHAR(20) NOT NULL DEFAULT 'doctor', -- doctor | pharmacist
    specialty     VARCHAR(120) NOT NULL DEFAULT '',
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_providers_partner ON providers(partner_id);

-- The clinician who picked up a consultation (in addition to the free-text
-- doctor_name already on the row).
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES providers(id) ON DELETE SET NULL;

-- When a pharmacist marked a prescription dispensed.
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS dispensed_at TIMESTAMPTZ;
