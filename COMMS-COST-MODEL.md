# MobiCova Health — Comms Cost Model (WhatsApp · SMS · USSD)

> The per-message comms bill is the line most likely to surprise you at scale — it grows
> with **member activity**, not member count, and can rival or exceed your server bill.
> This model lets you see the drivers and pull the right levers.
>
> **Everything here is a parameterised estimate.** Plug in your real expected volumes and
> verify unit rates against the current **Meta WhatsApp rate card (Nigeria)** and your
> SMS/USSD aggregator quotes before committing.

---

## 0. Assumptions

| Input | Assumed value | Note |
|-------|---------------|------|
| Scale | 50,000 active members | per the production plan |
| FX | ₦1,600 = $1 | NGN is volatile — re-check at time of contracting |
| WhatsApp model | Meta **per-message** pricing (2025+) | categories: Authentication / Utility / Marketing / Service |

### Assumed unit rates (verify against live rate cards)

| Channel / type | Unit rate (USD) | Source to confirm |
|----------------|-----------------|-------------------|
| WhatsApp — **Authentication** | ~$0.015 / msg | Meta Nigeria rate card |
| WhatsApp — **Utility** | ~$0.012 / msg (often free in open 24h service window) | Meta Nigeria rate card |
| WhatsApp — **Marketing** | ~$0.045 / msg | Meta Nigeria rate card |
| WhatsApp — **Service** (user-initiated, within 24h) | **free** | Meta |
| SMS — local transactional/OTP (DND-approved route) | ~₦3.5 ≈ $0.0022 | Termii / Africa's Talking |
| SMS — international fallback route | ~$0.02 | aggregator |
| USSD — **business-sponsored** session | ~₦5 ≈ $0.003 / session | Africa's Talking / telco |
| USSD — dedicated shortcode rental | ~$150–$300 / mo flat | telco |
| Claude (AI triage) | usage-based per token | Anthropic |

> **USSD billing note:** in Nigeria, USSD is frequently **end-user-paid** (the subscriber is
> charged per session by their telco), which makes it **~free to the business** apart from
> shortcode rental. If you sponsor sessions (toll-free to the member), you pay per session as
> modelled below. This single choice swings the USSD line dramatically.

---

## 1. Per-member monthly message profile (3 scenarios)

How many messages a typical active member generates per month, by channel:

| Per active member / month | Light | Medium | Heavy |
|---------------------------|-------|--------|-------|
| WhatsApp Authentication (logins, confirmations) | 4 | 8 | 12 |
| WhatsApp Utility (appointment, Rx ready, claim status) | 2 | 5 | 8 |
| WhatsApp Marketing (engagement/promo) | 0 | 1 | 3 |
| SMS OTP / transactional | 2 | 4 | 6 |
| USSD sessions (if sponsored) | 1 | 3 | 6 |

---

## 2. Cost per member per month

| Line | Light | Medium | Heavy |
|------|-------|--------|-------|
| WA Authentication | $0.060 | $0.120 | $0.180 |
| WA Utility | $0.024 | $0.060 | $0.096 |
| WA Marketing | $0.000 | $0.045 | $0.135 |
| SMS | $0.004 | $0.009 | $0.013 |
| USSD (sponsored) | $0.003 | $0.009 | $0.018 |
| **Per member / month** | **≈ $0.091** | **≈ $0.243** | **≈ $0.442** |

## 3. At 50,000 members

| | Light | Medium | Heavy |
|--|-------|--------|-------|
| **Per month** | **≈ $4,550** | **≈ $12,150** | **≈ $22,100** |
| **Per year** | **≈ $55k** | **≈ $146k** | **≈ $265k** |
| + USSD shortcode rental | +$150–300/mo | +$150–300/mo | +$150–300/mo |

> For context, your **infrastructure** run-rate at 50k is ~$1.5k–$3k/mo. **Comms can be
> 3–7× the server bill** in the medium/heavy cases — this is the number to manage.

---

## 4. The biggest levers (in order of impact)

1. **Make USSD end-user-paid, not sponsored.** Removes the entire USSD per-session line; you pay only shortcode rental. Largest swing if USSD is a primary channel.
2. **Minimise WhatsApp *Marketing* messages.** At ~$0.045 each they're ~3× utility/auth. Keep promos rare; use **Utility** templates for transactional notices.
3. **Stay inside the 24h *service window*.** User-initiated conversations are **free** for 24h — reply within it instead of opening new paid template conversations.
4. **Route OTP through local SMS** (DND-approved Nigerian routes ~₦3.5) rather than international, and prefer **WhatsApp Authentication** templates where the member is WhatsApp-active (often cheaper + better delivery).
5. **Batch & deduplicate notifications.** One combined utility message beats three.
6. **Cap/triage Claude usage.** Use the rules-based triage path first; call the model only when needed.

---

## 5. Worked planning figure

Assuming a realistic **Medium** profile at 50k:

- **Comms:** ~$12,150 / mo → **~$146k / yr**
- **+ USSD shortcode:** ~$250 / mo
- **+ Claude triage:** assume ~$500–$1,500 / mo depending on volume
- **+ Payment fees:** ~1.5% (Paystack) of money moved — pass-through, scales with GMV

**Planning line for comms + AI ≈ $13k–$14k / month at 50k Medium**, before payment fees —
materially larger than infra, and highly sensitive to the USSD and WhatsApp-Marketing
choices above. Tighten with your real channel mix and Meta/aggregator quotes.

---

## 6. How to firm this up

Give me three numbers and I'll replace the scenarios with your actuals:
1. **Channel split** — what % of members are active on WhatsApp vs USSD vs SMS vs app?
2. **USSD model** — end-user-paid or business-sponsored?
3. **Notification cadence** — roughly how many transactional messages per member per month do you expect (appointments, prescriptions, claims, reminders)?
