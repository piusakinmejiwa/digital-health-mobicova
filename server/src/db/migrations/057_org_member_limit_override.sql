-- 057 · Per-organisation member limit override
-- Lets a platform admin set a custom member seat cap on one org (negotiated
-- enterprise deals, or a low value for testing the limit/notification flow).
-- NULL = use the plan tier's default limit.

ALTER TABLE organisations ADD COLUMN IF NOT EXISTS member_limit_override INTEGER;
