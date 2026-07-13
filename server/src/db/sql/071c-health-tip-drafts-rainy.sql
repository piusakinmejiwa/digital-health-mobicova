-- Rainy-season batch: 10 timely health tips loaded as DRAFTS for admin review.
-- Nigeria's rainy season (roughly Apr–Oct) is peak time for cholera, malaria,
-- typhoid, childhood diarrhoea and flood hazards. Run AFTER migration 071 (needs
-- the new columns + status). Safe to re-run (inserts only titles that don't
-- already exist). Every row lands as status='draft' so NOTHING sends until an
-- admin publishes it in Health Tips → Tip library.
--
-- General public-health guidance only — no diagnosis, no drug names/dosages
-- (ORS, zinc and water treatment are named as standard public-health measures),
-- no invented statistics, no PHI. Dollar-quoted ($$...$$) so apostrophes are safe.

INSERT INTO health_tips (title, body, sms_text, why_it_matters, action, myth, fact, source, category, status)
SELECT v.title, v.body, v.sms_text, v.why_it_matters, v.action, v.myth, v.fact, v.source, v.category, 'draft'
FROM (VALUES
  ($$Act fast on cholera$$,
   $$Cholera causes sudden, heavy, watery diarrhoea that can dangerously drain the body of fluids within hours. Start oral rehydration salts (ORS) straight away and get to a health facility fast. It spreads through contaminated water and food, which is common in the rains.$$,
   $$Sudden watery diarrhoea can be cholera. Start ORS at once and get to a clinic fast — it drains fluids quickly.$$,
   $$Cholera can become life-threatening within hours through fluid loss, but prompt rehydration and care save lives.$$,
   $$Keep ORS sachets at home this season, and seek care immediately for heavy watery diarrhoea.$$,
   $$With cholera you should stop drinking so the diarrhoea slows.$$,
   $$The opposite is true — drinking ORS to replace lost fluids is exactly what prevents dangerous dehydration.$$,
   $$Nigeria CDC$$, $$prevention$$),

  ($$Make your water safe to drink$$,
   $$In the rainy season, floods and run-off can contaminate wells, boreholes and stored water. Make water safe by boiling it, or by treating it with a recommended water-treatment product used as directed, and store it in a clean, covered container.$$,
   $$Floods can contaminate water. Boil or properly treat your drinking water this rainy season, and store it covered.$$,
   $$Contaminated water spreads cholera, typhoid and diarrhoea, which all surge when it rains — treating water breaks that chain.$$,
   $$Boil or treat your drinking water today, and keep it in a clean, covered container.$$,
   $$Clear water is always safe to drink.$$,
   $$Water can look perfectly clear yet still carry germs — boiling or treating is what makes it safe.$$,
   $$WHO$$, $$hygiene$$),

  ($$Empty standing water weekly$$,
   $$Mosquitoes that spread malaria breed in still water. Old tyres, buckets, bottle caps, blocked gutters and empty containers around the home fill up in the rains and become breeding sites. Emptying or covering them each week cuts the mosquito population.$$,
   $$Mosquitoes breed in still water. Empty or cover tyres, buckets and gutters around your home every week.$$,
   $$Fewer breeding sites means fewer mosquitoes and less malaria, which peaks during the rainy season.$$,
   $$Walk around your home today and tip out or cover anything holding still water.$$,
   $$$$, $$$$,
   $$Nigeria CDC$$, $$prevention$$),

  ($$Treat a child's diarrhoea right$$,
   $$Diarrhoea is common in children during the rains, and the main danger is dehydration. Give oral rehydration salts (ORS) after each loose stool, keep feeding and breastfeeding, and ask a health worker about zinc. Seek care for blood in stool, repeated vomiting, or signs of dehydration.$$,
   $$For a child's diarrhoea, give ORS after each loose stool and keep feeding. See a clinic for blood or dehydration.$$,
   $$Most diarrhoea deaths in children come from dehydration, which ORS prevents simply and cheaply.$$,
   $$Keep ORS at home and start it at the first loose stool, while continuing to offer food and fluids.$$,
   $$You should stop feeding a child who has diarrhoea.$$,
   $$Continuing to feed and breastfeed helps a child recover faster and stay stronger.$$,
   $$WHO and UNICEF$$, $$prevention$$),

  ($$Stay out of flood water$$,
   $$Flood water often hides sharp objects, open drains and electrical hazards, and it can carry germs including those causing leptospirosis and diarrhoeal disease. Avoid walking or letting children play in it, and wash thoroughly with clean water and soap after any contact.$$,
   $$Avoid wading in flood water — it hides injuries, germs and electrical dangers. Wash well if you touch it.$$,
   $$Flood water causes injuries and spreads infection, so staying out of it prevents avoidable harm.$$,
   $$Keep yourself and children out of flood water, and wash with soap and clean water after any contact.$$,
   $$$$, $$$$,
   $$WHO$$, $$safety$$),

  ($$Keep food safe in the rains$$,
   $$Warm, damp weather helps germs multiply on food. Eat freshly cooked food while it is still hot, keep it covered from flies, and avoid food that has sat out for long. Wash fruits and vegetables with clean, safe water.$$,
   $$Eat food freshly cooked and hot, keep it covered from flies, and wash produce with clean water.$$,
   $$Contaminated food spreads typhoid, cholera and diarrhoea, which rise in the rainy season.$$,
   $$Cover your food today, and reheat any leftovers until steaming hot before eating.$$,
   $$$$, $$$$,
   $$Nigeria CDC$$, $$hygiene$$),

  ($$Keep your home dry and aired$$,
   $$Damp walls and poor ventilation in the rains encourage mould and can worsen coughs, asthma and chest infections. Open windows when it is dry, fix leaks, and wipe down damp surfaces to keep the air in your home healthier.$$,
   $$Damp and mould can worsen coughs and asthma. Air your home when dry, fix leaks and wipe damp surfaces.$$,
   $$A dry, well-aired home lowers the risk of chest problems, especially for children and people with asthma.$$,
   $$Open the windows in the next dry spell, and check for and dry any damp patches or leaks.$$,
   $$$$, $$$$,
   $$WHO$$, $$wellbeing$$),

  ($$Care for your feet in wet weather$$,
   $$Feet that stay wet in the rains can develop fungal infections and sores, particularly for people with diabetes. Dry your feet well, especially between the toes, change out of wet socks and shoes, and check regularly for cuts or itching.$$,
   $$Wet feet invite fungal infection. Dry between your toes, change wet socks, and check for cuts — especially with diabetes.$$,
   $$Small foot problems can turn into painful infections, and for people with diabetes they can become serious.$$,
   $$Dry your feet fully today, especially between the toes, and put on dry socks and shoes.$$,
   $$$$, $$$$,
   $$WHO$$, $$hygiene$$),

  ($$Stay safe around floods and electricity$$,
   $$Water and electricity are a deadly mix. During floods or storms, do not touch switches, sockets or appliances with wet hands or while standing in water, and stay well away from fallen power lines. Switch off the main supply if flooding threatens your home.$$,
   $$Never touch switches or appliances with wet hands or in flood water, and stay away from fallen power lines.$$,
   $$Electric shock in wet conditions can kill instantly, yet these deaths are preventable with simple caution.$$,
   $$Find your main switch now, and turn it off if flood water reaches your home.$$,
   $$$$, $$$$,
   $$WHO$$, $$safety$$),

  ($$Spot dehydration early$$,
   $$Dehydration can follow diarrhoea, vomiting or fever, all common in the rains. Warning signs include a very dry mouth, sunken eyes, passing little urine, and unusual tiredness — or restlessness in a child. Give oral rehydration salts (ORS) or fluids, and seek care if it is severe.$$,
   $$Dry mouth, sunken eyes and passing little urine signal dehydration. Give ORS or fluids, and seek care if severe.$$,
   $$Dehydration can become dangerous quickly, especially in children and older people, but is easily treated when caught early.$$,
   $$Learn these signs, keep ORS at home, and start fluids at the first sign of dehydration.$$,
   $$$$, $$$$,
   $$WHO$$, $$safety$$)
) AS v(title, body, sms_text, why_it_matters, action, myth, fact, source, category)
WHERE NOT EXISTS (SELECT 1 FROM health_tips h WHERE h.title = v.title);
