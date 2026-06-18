-- ───────────────────────────────────────────────────────────────────────────
-- AI Health Buddy — run-in-Supabase-SQL-Editor edition (migrations 033–035)
-- ───────────────────────────────────────────────────────────────────────────
-- Use this when `npm run migrate` can't reach the DB from your machine (ETIMEDOUT).
-- Paste the whole file into the Supabase dashboard → SQL Editor and run it.
-- Everything is idempotent and safe to re-run. Run this BEFORE the new buddy code
-- serves traffic (the app reads/writes these tables).

-- 1) buddy_sources — curated, FTS-searchable corpus (migration 033) -------------
CREATE TABLE IF NOT EXISTS buddy_sources (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        VARCHAR(80) UNIQUE NOT NULL,
    topic       VARCHAR(80)  NOT NULL,
    title       VARCHAR(200) NOT NULL,
    body        TEXT         NOT NULL,
    source_name VARCHAR(80)  NOT NULL,
    source_url  TEXT         NOT NULL,
    reviewed    BOOLEAN      NOT NULL DEFAULT false,
    tsv         tsvector GENERATED ALWAYS AS (
                  to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,''))
                ) STORED,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_buddy_sources_tsv ON buddy_sources USING GIN (tsv);

-- 2) buddy_messages — consented log / safety-review queue (033 + 035 column) -----
CREATE TABLE IF NOT EXISTS buddy_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_key VARCHAR(80)  NOT NULL,
    channel     VARCHAR(20)  NOT NULL DEFAULT 'web',
    role        VARCHAR(12)  NOT NULL,
    content     TEXT         NOT NULL,
    safety      VARCHAR(12)  NOT NULL DEFAULT 'ok',
    sources     JSONB        NOT NULL DEFAULT '[]'::jsonb,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_buddy_messages_session ON buddy_messages(session_key, created_at);
CREATE INDEX IF NOT EXISTS idx_buddy_messages_safety  ON buddy_messages(safety) WHERE safety <> 'ok';
ALTER TABLE buddy_messages ADD COLUMN IF NOT EXISTS specialty VARCHAR(40) NOT NULL DEFAULT 'general'; -- migration 035

-- 3) buddy_usage — free-tier daily cap (migration 033) ---------------------------
CREATE TABLE IF NOT EXISTS buddy_usage (
    session_key VARCHAR(80) NOT NULL,
    day         DATE        NOT NULL DEFAULT CURRENT_DATE,
    count       INT         NOT NULL DEFAULT 0,
    PRIMARY KEY (session_key, day)
);

-- 4) intake_sessions.mode — WhatsApp buddy vs enrolment (migration 034) ----------
ALTER TABLE intake_sessions ADD COLUMN IF NOT EXISTS mode VARCHAR(12) NOT NULL DEFAULT 'intake';

-- 5) Starter corpus (conservative general info; CLINICIAN MUST REVIEW before launch)
INSERT INTO buddy_sources (slug, topic, title, body, source_name, source_url) VALUES
('fever-basics','fever','Fever in adults','A fever is a temporary rise in body temperature, usually a sign the body is fighting an infection. Rest and drink plenty of fluids. Get medical care if the fever is very high, lasts more than three days, or comes with a stiff neck, rash, confusion, or trouble breathing.','NHS','https://www.nhs.uk/conditions/fever-in-adults/'),
('malaria-basics','malaria','Malaria','Malaria is caused by parasites spread through mosquito bites and is common in Nigeria. Symptoms include fever, chills, headache and body aches, usually 10–15 days after a bite. It can become severe quickly, so if you suspect malaria, get tested and treated promptly at a clinic.','WHO','https://www.who.int/news-room/fact-sheets/detail/malaria'),
('sore-throat','sore throat','Sore throat','Most sore throats are caused by viruses and clear up within a week. Drinking warm fluids, resting, and staying hydrated can help. See a clinician if it is severe, lasts longer than a week, makes swallowing or breathing hard, or comes with a high fever.','NHS','https://www.nhs.uk/conditions/sore-throat/'),
('common-cold','cold','Common cold','A cold is a mild viral infection of the nose and throat causing a runny nose, sneezing, sore throat and cough. Rest, fluids and time are the usual treatment; antibiotics do not help viral colds. See a clinician if symptoms are severe, last more than about ten days, or you have trouble breathing.','MedlinePlus','https://medlineplus.gov/commoncold.html'),
('headache','headache','Headaches','Most headaches are not serious and ease with rest, fluids and over-the-counter pain relief used as directed. Seek urgent care for a sudden severe headache, or a headache with fever and a stiff neck, weakness, confusion, vision loss, or after a head injury.','NHS','https://www.nhs.uk/conditions/headaches/'),
('dehydration-ors','hydration','Staying hydrated & oral rehydration','Diarrhoea and vomiting can cause dehydration, especially in children. Sip fluids often; oral rehydration salts (ORS) help replace lost water and salts. Get medical care for signs of severe dehydration such as very little urine, sunken eyes, dizziness, or a child who is unusually sleepy.','WHO','https://www.who.int/news-room/fact-sheets/detail/diarrhoeal-disease'),
('hypertension','blood pressure','High blood pressure','High blood pressure (hypertension) often has no symptoms but raises the risk of heart disease and stroke. A healthy diet lower in salt, regular activity, not smoking, and taking prescribed medicines help control it. Have your blood pressure checked regularly at a clinic or pharmacy.','WHO','https://www.who.int/news-room/fact-sheets/detail/hypertension'),
('diabetes','diabetes','Diabetes basics','Diabetes means blood sugar is too high. Common signs include increased thirst, frequent urination, tiredness and unintended weight loss. A healthy diet, activity and prescribed medicines help manage it. If you have these symptoms, get a blood sugar test at a clinic.','MedlinePlus','https://medlineplus.gov/diabetes.html'),
('menstrual-basics','menstrual','Periods (menstruation)','A typical menstrual cycle is around 21–35 days and periods last about 2–7 days. Mild cramps are common and ease with rest, warmth and pain relief used as directed. See a clinician for very heavy bleeding, periods that stop unexpectedly, or severe pain that disrupts daily life.','NHS','https://www.nhs.uk/conditions/periods/'),
('mental-health','mental health','Looking after your mental wellbeing','Feeling low, stressed or anxious at times is common. Talking to someone you trust, regular sleep, activity and routine can help. If feelings are intense, last more than two weeks, or affect daily life, reach out to a clinician or a support line — you do not have to cope alone.','NHS','https://www.nhs.uk/mental-health/')
ON CONFLICT (slug) DO NOTHING;

-- 6) Mark these migrations as applied so `npm run migrate` won't re-run them ------
INSERT INTO _migrations (name) VALUES
  ('033_ai_buddy.sql'), ('034_intake_session_mode.sql'), ('035_buddy_specialty.sql')
ON CONFLICT (name) DO NOTHING;

-- Verify
SELECT (SELECT count(*) FROM buddy_sources) AS corpus_rows,
       (SELECT count(*) FROM information_schema.columns WHERE table_name='intake_sessions' AND column_name='mode') AS has_mode,
       (SELECT count(*) FROM information_schema.columns WHERE table_name='buddy_messages' AND column_name='specialty') AS has_specialty;
