-- Generalise enrolment payment tracking beyond Stripe so Paystack (NGN-native,
-- the production choice for the Nigerian market) and a demo path are all
-- first-class. The original stripe_session_id column is retained for back-compat.
ALTER TABLE enrolments
    ADD COLUMN IF NOT EXISTS payment_provider  VARCHAR(20) DEFAULT '',
    ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255);
