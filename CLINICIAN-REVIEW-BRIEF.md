# MobiCova Health Buddy — Clinician Reviewer Brief & Sign-off Checklist

> Thank you for reviewing the **MobiCova Health Buddy** before launch. This is a **free,
> consumer, information-only** AI assistant for Nigeria. Your sign-off is the safety gate:
> nothing goes live until you approve the items below.

## 1. What the Health Buddy is (and isn't)
- **Is:** a friendly assistant that gives **basic, general health information**, answering
  **only from a curated set of trusted-source passages you approve** (WHO · NHS · MedlinePlus
  · CDC) and **citing** them. Every answer carries a disclaimer.
- **Is NOT:** a diagnosis, a prescription/dosing tool, a triage system, or an emergency/crisis
  service. Anything beyond basic info is routed to a **clinician (telemedicine)**; emergencies
  and self-harm are routed to **emergency care / crisis helplines**.

## 2. How it works (so you know what you're approving)
1. A **rule-based safety filter** runs first: self-harm language → crisis helplines; red-flag
   symptoms → "seek emergency care now". These **never** reach the AI model.
2. For everything else, the system **retrieves the most relevant approved passages** and the AI
   is instructed to **answer only from them and cite the source**. If nothing matches, it
   **declines** and points to a clinician — it does not use outside knowledge.
3. A disclaimer is always appended.

So the AI's medical content is **bounded by the corpus you approve** — that's the main thing to review.

## 3. What we need you to review
1. **Source corpus** — the ~10 starter passages (fever, malaria, sore throat, cold, headache,
   hydration/ORS, hypertension, diabetes, periods, mental wellbeing). For each: is it
   **accurate, safe, and appropriate for a Nigerian audience**? Edit wording, fix anything
   misleading, or remove.
2. **Scope boundaries** — confirm the hard rules are right: **no diagnosis, no prescriptions,
   no doses**, short general answers only.
3. **Crisis flow & helplines** — review the crisis message wording, and **verify the helpline
   numbers by test-dialling** before launch:
   - SURPIN 0800 0787 746 · MANI 0809 111 6264 · She Writes Woman 0800 800 2000 · Emergency 112
4. **Red-flag list** — confirm the emergency-trigger symptoms (chest pain, trouble breathing,
   stroke signs, severe bleeding, seizure, anaphylaxis, etc.) are the right set; add/remove.
5. **Disclaimer & consent** — confirm the medical disclaimer and data-consent wording are adequate.
6. **Escalation to care** — confirm "see a clinician / connect to a MobiCova doctor" is the right
   default for anything beyond basic info.

## 4. Sign-off checklist
- [ ] Each corpus passage is **medically accurate, safe, and appropriate for Nigeria** (edits noted)
- [ ] Scope boundaries confirmed (**no diagnosis / prescription / dosing**)
- [ ] Crisis message wording approved
- [ ] **Helpline numbers test-dialled and confirmed current**
- [ ] Red-flag / emergency symptom list approved
- [ ] Medical disclaimer wording approved
- [ ] Consent & data-handling wording approved
- [ ] Escalation-to-clinician default approved
- [ ] Approved topics list agreed; out-of-scope topics the buddy must **refuse** noted
- [ ] **Overall: approved for launch** (name, registration no., date, signature)

## 5. How to give feedback
For each corpus entry, mark **Approve / Edit (with new wording) / Remove**. We only enable an
entry once you've approved it (there is a `reviewed` flag on each passage). Send edits as a
simple list (entry name → change), or annotate this document.

## 6. Governance
- You are the **named medical reviewer** for the buddy's clinical content and crisis flow.
- The buddy is **information-only** and states this throughout; it does not replace professional
  care, and MobiCova carries the platform disclaimer and Terms of Use.
- **Re-review cadence:** before launch, and at least **quarterly** (or whenever the corpus,
  crisis flow, or helplines change). Helpline numbers should be re-confirmed each review.

---
*Reviewer:* ______________________  *Reg. no.:* ____________  *Date:* __________  *Signature:* __________
