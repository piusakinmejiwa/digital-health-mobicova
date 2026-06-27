# MobiCova × AXA Mansard — Demo Runbook

**A click-through for the AXA Mansard pitch / pilot demo**

MobiCova Health · June 2026

---

## The story (what we're showing)

MobiCova is the member + orchestration layer; AXA Mansard is the insurer. In ~15 minutes we show AXA that onboarding them is **push-button**, fully branded as *their* product, and that their members get telemedicine, claims, an AI health assistant and rewards across **web, WhatsApp and USSD** — with no build on their side.

Arc: **Onboard AXA → brand it as AXA → load their members → become a member and use it.**

---

## Part A — Pre-demo setup (do this *before* the meeting)

> Sign in as a **platform admin**. You'll land on the Admin Console.

### A1 · Onboard the AXA tenant
1. **Admin Console → Organisations → Onboard organisation.**
2. Name **AXA Mansard Health**, **Type = Underwriter**, Country Nigeria. Create.
3. On the confirmation, click **Continue to onboarding →** and run through the **insurer questionnaire** (NAICOM licence, products, policyholder book, claims, etc.). Fill a few fields per section so it looks real, then **Submit**. *(You can speed-run this — it's the "look how thorough our onboarding is" moment.)*

### A2 · Brand it as AXA (white-label)
**Organisations → AXA Mansard → Branding.** Use these AXA-style placeholder values:

| Field | Value |
|---|---|
| Display name | `AXA Mansard Health` |
| Logo letter | `A` |
| Primary colour | `#00008F` (AXA deep blue) |
| Accent colour | `#FF1721` (AXA red) |
| Support contact | `support@axamansard.example.com` |
| WhatsApp greeting | `Welcome to AXA Mansard Health, powered by MobiCova.` |

Save. *(Swap in AXA's real logo/hex later — this is enough to look branded for the demo.)*

### A3 · Load the members
1. **Organisations → AXA Mansard → Members & docs → Import.**
2. Choose **`AXA-Mansard-sample-members.csv`** (15 sample members).
3. **Validate (dry run)** first — show "would import 15, 0 skipped". *(This dry-run is itself a great demo beat — "we check the file before touching anything".)*
4. Then **Import**.

### A4 · Add a demo doctor (so telemedicine works live)
**Admin Console → Providers → Add a provider:** Role **Doctor**, pick a **Clinic** partner, name e.g. `Dr. Demo Physician`, a specialty, a login email + strong password, upload a photo. *(Needed if you'll show a live video consult.)*

### A5 · One email-only member for the live login
Member login uses an OTP. The sample members have phones, so their code goes by **SMS (sandbox → AT simulator)** — fiddly live. So add **one** member with **email only (no phone)**, email = an inbox you control, via **View as org → Members → Add member**. You'll log in as this member during the demo and the OTP lands in your inbox.

---

## Part B — Live demo click-through

### B1 · "Onboarding any insurer is push-button" *(platform view)*
- Show the **Organisations** list with **AXA Mansard** sitting alongside other tenants.
- Open its **Onboarding** to show the captured insurer profile. Message: *"Same rails onboard Leadway, an HMO, a telco — no new build."*

### B2 · "It's AXA's product, not ours" *(View as org)*
- Click **View as org** on AXA Mansard. You enter AXA's dashboard with the **"Viewing as AXA Mansard"** banner.
- Show the **branded** dashboard, the **Members** list (your 15 imported members), branding, claims, analytics.

### B3 · "Here's what an AXA member gets" *(member app)*
- Open **`/member/login`** in another window, sign in as the **email-only** member (OTP to your inbox).
- Walk the **branded member app**: Home, **Care → Talk to a doctor** (start a quick **video consult**; your demo doctor joins from `/provider/login`), **Claims** (submit one), **AI Health Assistant** (triage a symptom), **Rewards** (points, streak, badges).

### B4 · "Even on a feature phone" *(USSD/WhatsApp — optional)*
- In the **AT USSD web simulator** (`*384*30850#`), enter a member's number → show the member menu (cover, claims, prescriptions, callback, rewards). Message: *"Your members reach AXA Mansard Health with zero data, on any phone."*

### B5 · Exit
- Click **Exit to Admin Console** to drop the AXA context — reinforces the clean platform-admin separation.

---

## Part C — Talking points (the value for AXA)

- **Zero build for AXA** — onboarded, branded and live in minutes.
- **Engagement = fewer claims** — telemedicine + rewards keep members healthy and out of hospital.
- **Every channel** — web, WhatsApp, USSD; reaches banked and unbanked, smartphone and feature phone.
- **Repeatable** — the same platform onboards every future insurer/employer/telco.
- **Compliant** — NDPR-aware, audit-logged, consent-gated recording.

---

## Tips & gotchas

- **Member OTP:** members with a phone get the code by SMS (sandbox simulator). For smooth live login use the **email-only** demo member (Part A5), or log in *before* the demo (the session persists).
- **Always-on:** `mobicova-api` is on an always-on plan, so no cold-start lag on the first call.
- **USSD on real phones** needs AT's **live production code** (pending) — for the demo, use the **web simulator**.
- **Reset between runs:** you can re-import or edit members freely; "View as org → Exit" returns you to the Console any time.

---

*MobiCova Health — onboard any insurer, branded as theirs, live on every device.*
