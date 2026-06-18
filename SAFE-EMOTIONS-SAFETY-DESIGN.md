# Safe Emotions — Safety Design & Launch Gate

> "Safe Emotions" is the emotional-wellbeing companion in the MobiCova Health Buddy. It is
> the highest-duty-of-care feature, so it has its own safety design and **must not launch**
> until the clinician **and** legal reviewer sign the gate at the end of this document.

## 1. What it is — and isn't
- **Is:** a warm, gentle companion that **listens and validates feelings**, gently encourages
  reaching out to a trusted person or helpline, and keeps difficult moments from being faced alone.
- **Is NOT:** therapy, counselling, diagnosis, medication advice, or a crisis/emergency service.
  It never replaces professional care.

## 2. Risk tiers & responses (deterministic — no AI call)
Every incoming message is first classified by **rule-based** detection that runs *before* any
model call, so the safety response is reliable and predictable:

| Tier | Trigger (examples) | Response |
|------|--------------------|----------|
| **Crisis** | "kill myself", "end it all", "don't want to live", self-harm/overdose | Compassionate message + **helplines** (SURPIN, MANI, She Writes Woman) + "call 112 / nearest hospital". No model call. |
| **Emergency** | chest pain, can't breathe, stroke signs, severe bleeding | "Seek urgent care now — call 112 / nearest hospital." No model call. |
| **Distress** | "overwhelmed", "hopeless", "worthless", "hate myself", "can't cope" | Warm, validating reply + **gentle helpline offer** + invites the person to keep talking. No model call. |
| **OK** | everything else | Short, supportive companion reply (model, guardrailed) + **always-on helpline footer**. |

> Misclassification is biased toward safety: ambiguous low-mood phrases fall into **Distress**,
> which *still surfaces helplines*. Benign idioms ("could kill for a coffee", "dying to see you")
> are explicitly excluded (verified by tests).

## 3. Generation guardrails (the OK tier)
When the model does reply, its system instructions hard-require:
- Listen and **validate first**; kind, calm, non-judgemental; short (2–4 sentences).
- **Never** diagnose, give medication/medical advice, or promise to fix things.
- **Never** provide methods of self-harm or anything that could cause harm; **never minimise** feelings.
- Always gently encourage reaching out to a trusted person or helpline, and offer to keep listening.
- If self-harm intent appears, urge contacting a crisis helpline / emergency services immediately.

Plus an **always-visible helpline strip** on the Safe Emotions screen and a helpline **footer** on
every reply, so help is one tap away at all times.

## 4. Helplines (verified June 2026 — re-confirm at go-live)
SURPIN **0800 0787 746** · MANI **0809 111 6264** · She Writes Woman **0800 800 2000** · Emergency **112**.
The clinician must **test-dial** each before launch and at every review.

## 5. Data & privacy (sensitive conversations)
- **Consent** shown before use; conversations are **logged** (`buddy_messages`) to a **safety-review
  queue**, with crisis/distress flagged for follow-up.
- **Data minimisation**, a defined **retention policy**, **no training** on user data, and NDPR
  alignment (encryption/residency per the production plan).
- Access to the review queue is restricted to the named reviewer(s).

## 6. Escalation
- **Crisis/distress → helplines** (above) + offer of a human.
- **Beyond emotional support → telemedicine** (a MobiCova clinician).
- Live human hand-off is a **future** enhancement (not in this MVP) — documented as a limitation.

## 7. Monitoring & review
- Daily review of the **crisis/distress queue**; act on anything needing follow-up.
- Re-test the detection phrases and **re-confirm helplines** at each review (≥ quarterly).
- Track false negatives/positives and tune the rules.

## 8. Limitations (state these plainly to users and reviewers)
- Rule-based detection **can miss** indirect or coded expressions; it is a safety net, not a guarantee.
- It is **not a clinical tool**, not monitored in real time, and **not a 24/7 human service**.
- It is information/support only and does not replace professional mental-health care.

---

## Launch gate — both signatures required
- [ ] Crisis, emergency and distress responses reviewed and approved
- [ ] Generation guardrails (system rules) approved
- [ ] **Helplines test-dialled and confirmed current**
- [ ] Consent, retention and data-handling for sensitive conversations approved
- [ ] Limitations are clearly disclosed to users
- [ ] Safety-review queue + monitoring cadence agreed
- [ ] Legal review of disclaimers, consent and crisis flow complete

**Clinician:** __________________  Reg: ________  Date: ______  Signature: ______
**Legal/DPO:** __________________  Date: ______  Signature: ______

> Until both sign, keep Safe Emotions **disabled in production** (it can be hidden from the buddy
> dashboard with a feature flag) while the rest of the Health Buddy goes live.
