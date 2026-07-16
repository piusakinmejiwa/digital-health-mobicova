-- Tags for health tips, so a set of tips can be grouped and bulk-enabled/disabled
-- independent of category — e.g. retire all 'rainy-season' tips when the dry
-- season starts, then bring them back next year, in one click. Generic: reuse
-- for 'harmattan', 'ramadan', or any campaign set later.

ALTER TABLE health_tips
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

-- Label the rainy-season batch (matched by title; idempotent — only adds the tag
-- if it isn't already there). Covers rows whether the 071c seed ran before or
-- after this migration.
UPDATE health_tips
   SET tags = array_append(tags, 'rainy-season')
 WHERE title IN (
   'Act fast on cholera',
   'Make your water safe to drink',
   'Empty standing water weekly',
   'Treat a child''s diarrhoea right',
   'Stay out of flood water',
   'Keep food safe in the rains',
   'Keep your home dry and aired',
   'Care for your feet in wet weather',
   'Stay safe around floods and electricity',
   'Spot dehydration early'
 )
   AND NOT ('rainy-season' = ANY(tags));

-- Bookkeeping: record this migration so /health and the CI migration gate stay in
-- sync when applied by pasting (the npm run migrate runner records it automatically).
INSERT INTO _migrations (name) VALUES ('072_health_tip_tags.sql') ON CONFLICT (name) DO NOTHING;
