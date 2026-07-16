-- Richer Daily Health Tips. A tip grows from just (title, body) into a structured
-- card so we can render it well per channel: a lean SMS, a medium WhatsApp message,
-- and a rich branded email (headline → body → why it matters → an action step →
-- optional myth/fact → a credible source). Content is still curated/reviewed public
-- health guidance — no PHI. New AI-drafted tips land as status='draft' and never
-- send until a human publishes them.

ALTER TABLE health_tips
  ADD COLUMN IF NOT EXISTS sms_text       TEXT        NOT NULL DEFAULT '', -- lean 1-segment version for SMS
  ADD COLUMN IF NOT EXISTS why_it_matters TEXT        NOT NULL DEFAULT '', -- the "so what" — one short paragraph
  ADD COLUMN IF NOT EXISTS action         TEXT        NOT NULL DEFAULT '', -- a single "try this today" step
  ADD COLUMN IF NOT EXISTS myth           TEXT        NOT NULL DEFAULT '', -- optional myth-vs-fact hook (the myth)
  ADD COLUMN IF NOT EXISTS fact           TEXT        NOT NULL DEFAULT '', -- optional myth-vs-fact hook (the fact)
  ADD COLUMN IF NOT EXISTS source         VARCHAR(200) NOT NULL DEFAULT '', -- credible reference, e.g. "WHO", "Nigeria CDC"
  ADD COLUMN IF NOT EXISTS status         VARCHAR(20)  NOT NULL DEFAULT 'published'; -- 'draft' | 'published'

-- Existing rows were created before status existed → treat them as published.
UPDATE health_tips SET status = 'published' WHERE status IS NULL OR status = '';

-- Enrich the 8 starter tips so they render richly from day one (matched by title;
-- safe to re-run — only fills the new fields, leaves title/body untouched).
UPDATE health_tips SET
  sms_text = 'Aim for 6-8 glasses of clean water daily. Sip regularly — thirst means you are already low.',
  why_it_matters = 'Even mild dehydration causes headaches, tiredness and poor concentration, and in Nigeria''s heat you lose fluid faster than you notice. Older adults and children are most at risk.',
  action = 'Fill a bottle now and keep it where you work; finish and refill it twice before evening.',
  source = 'WHO'
WHERE title = 'Stay hydrated';

UPDATE health_tips SET
  sms_text = 'A brisk 30-min walk most days protects your heart. No time? Three 10-min walks count too.',
  why_it_matters = 'Regular movement lowers blood pressure, helps control blood sugar, and cuts your risk of heart disease and stroke — the fastest-rising causes of death among Nigerian adults.',
  action = 'Take a 10-minute brisk walk after one meal today. Build up to 30 minutes on most days.',
  myth = 'You need a gym and expensive kit to get fit.',
  fact = 'Brisk walking, dancing and taking the stairs give most of the same benefit for free.',
  source = 'WHO'
WHERE title = 'Move every day';

UPDATE health_tips SET
  sms_text = 'Wash hands with soap for 20 seconds before eating and after the toilet. It prevents infection.',
  why_it_matters = 'Hand-washing is one of the cheapest ways to stop the spread of diarrhoea, typhoid, cholera and respiratory infections — illnesses that still send many Nigerians to hospital each year.',
  action = 'Keep soap by every tap at home today, and wash for the length of singing "Happy Birthday" twice.',
  source = 'Nigeria CDC'
WHERE title = 'Wash your hands';

UPDATE health_tips SET
  sms_text = 'High blood pressure often has no symptoms. Over 40 or a family history? Get checked regularly.',
  why_it_matters = 'High blood pressure is called the "silent killer" because it damages the heart, kidneys and brain for years with no warning signs. About 1 in 3 Nigerian adults has it, and many do not know.',
  action = 'Book a blood-pressure check at your nearest pharmacy or clinic this week — it takes two minutes.',
  myth = 'You would feel it if your blood pressure was high.',
  fact = 'Most people feel completely normal — the only way to know is to measure it.',
  source = 'Nigerian Hypertension Society'
WHERE title = 'Check your blood pressure';

UPDATE health_tips SET
  sms_text = 'Fill half your plate with vegetables and fruit of different colours for a wider range of nutrients.',
  why_it_matters = 'Different colours carry different vitamins, minerals and fibre. A varied plate supports your immune system, digestion and long-term protection against diabetes and some cancers.',
  action = 'Add one extra vegetable to your main meal today — ugwu, spinach, tomatoes, carrots or peppers all count.',
  source = 'WHO'
WHERE title = 'Eat the rainbow';

UPDATE health_tips SET
  sms_text = 'Adults need 7-9 hours of sleep. Keep a regular bedtime and put the phone away 30 min before bed.',
  why_it_matters = 'Poor sleep raises blood pressure, weakens the immune system and makes it harder to concentrate and manage stress. Good rest is not a luxury — it is basic maintenance for your body.',
  action = 'Pick a fixed bedtime tonight and switch your phone to silent 30 minutes before it.',
  source = 'WHO'
WHERE title = 'Protect your sleep';

UPDATE health_tips SET
  sms_text = 'Fever, chills, headache and body aches can mean malaria. Get a test early — do not self-treat.',
  why_it_matters = 'Malaria remains one of the biggest health threats in Nigeria and can turn severe within days, especially for children under five and pregnant women. A quick test confirms it before you treat.',
  action = 'If you or your child has a fever, get a malaria test at a clinic or pharmacy the same day.',
  myth = 'Any fever can be treated with leftover malaria drugs at home.',
  fact = 'Not every fever is malaria, and wrong or half-doses fuel drug resistance. Test first, then treat.',
  source = 'Nigeria CDC'
WHERE title = 'Know the malaria signs';

UPDATE health_tips SET
  sms_text = 'Finish the full course of antibiotics even if you feel better, and never share prescription medicine.',
  why_it_matters = 'Stopping antibiotics early lets the strongest germs survive and come back harder — this is how drug-resistant infections spread. Sharing medicine means wrong doses for the wrong illness.',
  action = 'Check any medicine you are on today: are you taking it exactly as prescribed, to the end of the course?',
  myth = 'You can stop antibiotics once you feel fine.',
  fact = 'Feeling better does not mean the infection is gone — finishing the course is what clears it safely.',
  source = 'WHO'
WHERE title = 'Take medicines as prescribed';

-- Bookkeeping: record this migration so /health and the CI migration gate stay in
-- sync when applied by pasting (the npm run migrate runner records it automatically).
INSERT INTO _migrations (name) VALUES ('071_health_tips_rich.sql') ON CONFLICT (name) DO NOTHING;
