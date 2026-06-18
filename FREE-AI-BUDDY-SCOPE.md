# MobiCova Health — Free AI Health Buddy (Scope)

> A free, friendly AI chat companion that gives **basic, source-grounded health tips** —
> a top-of-funnel consumer product that feeds the B2B platform (telemedicine, insurance).
> Built on the existing Anthropic integration (`config/anthropic.ts`, `triage.service.ts`).
>
> Figures are planning-grade. Safety is the gating concern, not the tech.

---

## 1. What it is — and isn't

**Is:** a warm, plain-language assistant for **general health information** ("what helps a sore throat?", "is this a normal period symptom?"), grounded in trusted sources, that **cites where the answer came from** and always nudges toward a clinician for anything real.

**Is NOT:** a diagnosis, a prescription, a dosage calculator, or an emergency service. Every answer carries a disclaimer; anything beyond basic info routes to **telemedicine** (the paid funnel) or, for emergencies/crises, to **human help + helplines**.

**Strategic note:** this is a **B2C layer on a B2B platform** — a deliberate second product. Free usage at 100k users is a real cost (modelled below) and a real growth engine (it acquires members who convert to telemedicine/insurance).

---

## 2. Product behaviour
- **Persona:** friendly, calm, non-judgemental, short answers, plain English (and ideally Pidgin/local-language later).
- **Grounded + cited:** answers are built from a **curated trusted-source knowledge base**; each reply shows its sources. If the answer isn't in the sources, the buddy says so rather than guessing.
- **Always disclaimered:** a persistent "information, not medical advice — see a clinician" line.
- **Escalates intelligently:**
  - Red-flag symptoms (chest pain, stroke signs, severe bleeding) → "seek emergency care now".
  - Beyond basic info → "let's connect you to a doctor" → **telemedicine**.
  - Self-harm / crisis language → immediate **crisis response + helplines** + offer a human (this is the "Safe Emotions" duty-of-care path).
- **Channels:** web/app chat first; **WhatsApp** next (user-initiated chat is free on Meta's side within the 24h window); USSD is too constrained for free-form chat (menu-only).

---

## 3. Architecture (RAG + safety pipeline)
A retrieval-augmented pipeline with safety on both ends — see the architecture diagram (`diagrams/08-ai-buddy-architecture.svg`).

```
channel → API → buddy orchestrator
   1. SAFETY PRE-FILTER  (crisis / red-flag / out-of-scope detection)
   2. RETRIEVE           (vector search over the trusted-source corpus)
   3. GENERATE           (Claude Haiku 4.5, "answer only from sources + cite")
   4. SAFETY POST-FILTER (disclaimer, scope check, escalation CTA)
→ cited reply + disclaimer  (or escalation: emergency / telemedicine / crisis helpline)
```

- **Model tiers:** **Haiku 4.5** (`claude-haiku-4-5`) for the free basic tier — fast and cheap; **Sonnet 4.6** (`claude-sonnet-4-6`) only when a question is flagged complex. *(The repo currently defaults `ANTHROPIC_MODEL` to an older Sonnet — update it.)*
- **Grounding store:** start simple (a curated corpus + Postgres `pgvector` for retrieval, which Supabase supports), so we don't add new infra.
- **Prompt caching:** the system prompt + persona + safety rules are **cached** (cache reads ~10× cheaper than fresh input) — a big lever at 100k scale.
- **Rate limiting + abuse control** on the free tier (per-user/day cap), reusing the existing limiter pattern.
- **Reuse:** extends `triage.service.ts` + `config/anthropic.ts`; adds a retrieval step, persona, citations, and the safety filters.

---

## 4. "Verified by Wikipedia / a trusted encyclopedia"
Implemented as **retrieval-grounded answers with citations**, and a deliberate **source hierarchy** (Wikipedia is useful but not authoritative for medicine):

1. **Primary (authoritative):** WHO fact sheets, NHS Health A–Z, MedlinePlus, CDC.
2. **Secondary (context):** Wikipedia medical articles (which follow medical-sourcing guidelines).
3. The model is instructed to **answer only from retrieved passages and cite them**; if unsupported, it declines and points to a clinician.
4. **Human review:** a clinician reviews the curated corpus and the canned answers for high-traffic topics before launch.

This gives you the "verified" property *and* controls cost (grounding shortens answers and cuts hallucination-driven retries).

---

## 5. Safety & compliance (the gating work)
- **Persistent medical disclaimer** on every answer; clear Terms of Use ("not a substitute for professional advice").
- **Scope guardrails:** no diagnosis, no prescriptions, no dosing, no emergency triage beyond "seek care".
- **Crisis detection (Safe Emotions):** detect self-harm/suicidal intent → immediate supportive message + **Nigerian helplines** (e.g. Mentally Aware Nigeria Initiative) + emergency guidance + offer a human hand-off. **Do not ship the emotional-wellbeing buddy without this.**
- **Red-flag symptom detection** → emergency guidance.
- **Escalation to care:** hand off to **telemedicine** (the conversion path).
- **NDPR / privacy:** new consumer PII + health conversations are sensitive — explicit consent, data minimisation, a retention policy, no training on user data, and (later) encryption/residency per the production plan.
- **Age:** paediatrics/menstrual topics imply minors — decide an **age policy** (gate or parental framing).
- **Logging & review:** store conversations (consented) for a safety-review queue; audit crisis escalations.
- **Legal review** of disclaimers and the crisis flow before launch.

---

## 6. Cost model at 100k users
**Assumptions:** Haiku 4.5 ($1/M input, $5/M output; cache-read ~$0.10/M). Per message ≈ **1.5k cached** system/safety tokens (read), **~2.3k uncached** input (RAG snippets + history + question), **~400** output tokens → **≈ $0.0045 / message**. (Sonnet 4.6 would be ~$0.013 — ~3× — so reserve it for flagged-complex questions.)

| Scenario (of 100k registered) | Active users | Msgs/user/mo | Messages/mo | **Cost/mo** |
|---|---|---|---|---|
| Conservative (30% active, light) | 30k | 5 | 150k | **≈ $675** |
| Likely (30% active, medium) | 30k | 15 | 450k | **≈ $2,000** |
| High (50% active, medium) | 50k | 15 | 750k | **≈ $3,400** |
| Peak (100% active, heavy) | 100k | 30 | 3.0M | **≈ $13,500** |

> So the **free AI runs ~$700–$3,400/mo in the realistic band**, spiking toward ~$13.5k only if the whole base is heavily active. This is **on top of** the infra run-rate and folds into the comms/AI cost model.

**Cost levers (apply from day one):**
1. **Keep the free tier on Haiku 4.5**; escalate to Sonnet only on flagged-complex questions (~10% → blended ≈ $0.0054/msg).
2. **Prompt-cache** the system + safety prompt (already assumed — the single biggest saver).
3. **Canned answers** for the top FAQ topics (served from a reviewed library, **zero model cost**).
4. **Rate-limit** the free tier (e.g. N messages/user/day) to cap abuse and runaway cost.
5. **Short, grounded answers** (cap output tokens) — grounding naturally shortens replies.
6. **WhatsApp side is largely free** for user-initiated chat within the 24h window (no template fees).

---

## 7. Build plan (phased — validate, then scale)
1. **MVP — web general buddy:** persona + RAG over a small curated corpus (WHO/NHS/MedlinePlus) + Haiku 4.5 + disclaimer + **crisis & red-flag detection** + rate-limited free tier. *Reuses existing AI infra.*
2. **WhatsApp channel** for the buddy.
3. **Specialty buddies** (the dashboard selector) — add by **demand rank from the `/shape` data**: menstrual, dietetics, paediatrics, etc., each a persona + domain corpus.
4. **"Safe Emotions" / mental-health** buddy — last and most carefully, with a full crisis-safety design + human-escalation + legal sign-off.
5. **Scale hardening** — caching, canned-answer library, cost dashboards, abuse defence; cut over with the production plan.

---

## 8. Effort & open decisions
- **MVP effort:** ~2–3 weeks for the web general buddy (retrieval + persona + safety + citations + free-tier limits), building on the existing assistant.
- **Open decisions (yours):**
  1. **Source list** — confirm the trusted set (WHO/NHS/MedlinePlus/CDC + Wikipedia as secondary)?
  2. **Clinician reviewer** — who signs off the corpus + canned answers + crisis flow?
  3. **Age policy** — gate under-18, or parental framing?
  4. **Free-tier limits** — messages/user/day?
  5. **Channels at launch** — web only, or web + WhatsApp?
  6. **Crisis helplines** — confirm the Nigerian helpline numbers/partners to surface.

Answer these and the MVP is ready to build — starting with the **web general buddy**, validated by whatever the `/shape` page tells you prospects want most.
