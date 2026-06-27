# MobiCova Rewards — Product Scope

**Gamification for member engagement, adherence and retention**

MobiCova Health · Prepared June 2026

---

## 1. Why gamification, and why now

MobiCova sells to insurers and employers (AXA Mansard, and any HMO/insurer thereafter). For those buyers the economics are direct: **engaged, healthier members generate fewer claims.** Gamification — points, streaks, badges, challenges and rewards — is one of the few member-facing levers proven to move the behaviours that matter:

- **Adherence** — taking chronic medication (hypertension, diabetes), refilling on time.
- **Preventive uptake** — annual check-ups, screenings, early triage instead of late presentation.
- **Engagement & retention** — members open the app and self-serve instead of forgetting the benefit exists.

It is also a clear commercial differentiator: *"our members stay engaged"* is something a partner will pay for, and it strengthens every renewal conversation.

## 2. Design principles

- **Insurer-aligned, not vanity points.** Every mechanic traces to an outcome a partner cares about.
- **Multi-tenant from day one.** Points rules, challenges and reward funding are configured per organisation — one build serves every insurer/employer.
- **Channel parity.** Members on USSD and WhatsApp earn and check points too (identified by phone number), not only on the web app.
- **Privacy by design (NDPR).** Health data never appears on a leaderboard. Participation is opt-in. Rewards encourage, never penalise.
- **Anti-gaming.** Every award is idempotent (one action credited once) and rate-bounded.

## 3. Phased delivery

### Phase 0 — Points engine (foundation)
The spine everything hangs off.

- An immutable points **ledger** (one row per awarded action, deduplicated so nothing is ever double-credited).
- Per-member running **totals and streak** counters.
- A single `award(action)` helper that is idempotent and best-effort — it can never break the underlying action it rewards.

### Phase 1 — Streaks, points and badges *(demo-ready)*
Rewards actions the platform already tracks, so there is minimal new surface to capture.

- **Award hooks** on existing events: daily check-in (opening the app), Health Buddy / triage, completing a consultation, collecting a prescription on time, completing the health profile.
- **Streaks** — a daily engagement counter ("7-day streak").
- **Badges** — milestone set (First Consult, Profile Pro, Adherence Star, 7- and 30-day streaks, Centurion at 100 points).
- **Member Rewards screen** — points, streak, earned badges and the next ones to unlock.
- **USSD/WhatsApp** — a "My rewards" menu option so feature-phone members see their points.

### Phase 2 — Challenges (cohort, opt-in)
Time-boxed goals an insurer configures for its members.

- Examples: "Log your blood pressure five times this month", "Complete your annual check-up", an employer step or hydration challenge.
- Configured per tenant from the Admin Console.
- **Leaderboards are cohort-level and anonymised only** — no health data, no naming individuals unless they opt in.

### Phase 3 — Rewards catalogue and redemption *(the insurer-funded payoff)*
Where points become real value, and where the commercial model is strongest.

- **Reward types:** premium discount, airtime top-up, pharmacy voucher, wellness perks.
- **Funding model:** the **insurer funds the rewards**, because an engaged member who attends a check-up costs them less downstream.
- **Fulfilment:** one gated adapter per reward type, degrading gracefully until configured (the same pattern used across MobiCova's integrations).

## 4. Cross-cutting

- **Insurer analytics** — engagement and adherence dashboards per tenant, to evidence ROI at renewal.
- **Audit** — every award and redemption recorded.
- **Per-tenant kill switch** — gamification can be turned off for clients who do not want it.

## 5. Recommended cut

**Build Phase 0 + Phase 1 first** — a self-contained, demonstrable engagement loop. Phases 2 and 3 follow once a partner is engaged, and Phase 3's reward funding becomes a commercial conversation rather than only an engineering task.

| Phase | Depends on | External dependency |
|---|---|---|
| 0 — Engine | — | None |
| 1 — Streaks / badges | 0 | None — buildable today |
| 2 — Challenges | 0, 1 | None |
| 3 — Rewards | 0, 1 | Airtime, pharmacy vouchers, premium-discount billing |

## 6. Status

Phase 0 and Phase 1 are **built**: the points engine, award hooks on existing member actions, the member Rewards screen, and the USSD/WhatsApp "My rewards" option. Phases 2 and 3 are scoped and ready to schedule.

---

*MobiCova Health — connecting members to care, and keeping them engaged with it.*
