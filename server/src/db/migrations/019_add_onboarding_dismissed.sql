-- Phase 1: onboarding checklist. The only stored bit of onboarding state is a
-- per-user "I've dismissed the setup banner" preference; actual step completion
-- is derived server-side from real signals (plans, members, users, webhooks) so
-- it can never drift out of sync.
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_dismissed BOOLEAN NOT NULL DEFAULT false;
