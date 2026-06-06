# MobiCova — Manual Test Script (UAT) · Full Platform

A click-by-click script for a tester to verify the live MobiCova platform end to end. No technical
knowledge needed — just a web browser. Work top to bottom; some later tests rely on data created in
earlier ones.

This single document covers everything in three parts:
- **Part A — Core platform** (Tests 1–20): dashboard, members, telemedicine, insurance, claims,
  analytics, channels, admin, 2FA, SSO, API keys, member & provider portals, security isolation.
- **Part B — SaaS features** (Tests 21–31): public marketing site, onboarding, command palette &
  help, docs, inbox, analytics query builder, API console, billing, white-label branding, member app.
- **Part C — Unified organisation model** (Tests 32–39): organisations by type in the Platform Admin
  Console, supply-org (clinic/pharmacy) dashboards, self-service staff, cross-org isolation, and the
  clinician multi-clinic switcher.

- **Estimated time:** ~90–120 minutes for the full pass (or run a part at a time).
- **How to record results:** for each step, mark the **Result** column **Pass** or **Fail**. If it
  fails, write what you saw in **Notes** (a screenshot helps).

---

## 1. Before you start

### Test environment
The whole platform runs on **one domain** — there is no separate website per organisation. Base URL:
`https://mobicova-client.onrender.com` (custom domain `https://digitalhealth.mobicova.com` once DNS
is live). There are **three login pages**:

| What | Where |
|------|-------|
| Public marketing site | https://mobicova-client.onrender.com/ (the **root** URL) |
| Dashboard / org admins / **platform admin** | **Sign in** from the site, or go to `/login` → lands on `/dashboard` |
| Member portal | https://mobicova-client.onrender.com/member/login |
| Provider portal (clinicians) | https://mobicova-client.onrender.com/provider/login |

> 🆕 **The root URL `/` is the public marketing site**, not the dashboard. Use **Sign in** (top
> right) to reach the app.
>
> 🔑 **One login for all staff.** Underwriters, companies, telcos **and** clinic/pharmacy admins all
> sign in at the same `/login` — which organisation they see is decided by their account, not the URL.
> The **Platform Admin Console** is *not* a separate login: a platform-admin account signs in at
> `/login` and gets an extra **Admin Console** item in the sidebar (→ `/admin`).
>
> 🌐 **Organisations do not have their own URLs.** Creating a new organisation does **not** create a
> new web address — its admin signs in at the same `/login`.
>
> ⏳ **First load may take ~30 seconds.** The server sleeps when idle and wakes on the first request.

### Logins
| Role | Email | Password | Signs in at |
|------|-------|----------|-------------|
| **Platform admin** (also the underwriter org admin) | `admin@axamansard.demo` | `MobiCova!Demo-2026` | `/login` |
| **Clinic** org admin (Helium Health) | `clinic@mobicova.demo` | `MobiCova!Demo-2026` | `/login` |
| **Clinic** org admin (DrConsult) | `clinic2@mobicova.demo` | `MobiCova!Demo-2026` | `/login` |
| **Pharmacy** org admin (HealthPlus) | `pharmacy@mobicova.demo` | `MobiCova!Demo-2026` | `/login` |
| Provider — **doctor** (spans 2 clinics) | `doctor@mobicova.demo` | `MobiCova!Demo-2026` | `/provider/login` |
| Provider — **pharmacist** | `pharmacist@mobicova.demo` | `MobiCova!Demo-2026` | `/provider/login` |
| **Member** (portal) | `amaka.obi@member.demo` | *no password — uses a one-time code* | `/member/login` |

> The clinic/pharmacy admins above only exist after the org-model seed has been run (`npm run seed`).
> They are **supply-side** org admins — they get a focused dashboard (their queue + their staff) and
> cannot see members, claims or other organisations.

> 🔐 **Important — the admin account has two-factor authentication (2FA) switched on.**
> When you sign in as the admin you'll be asked for a 6-digit code after the password.
> **The site owner must give you one of these to start:**
> 1. The current 6-digit code from their authenticator app (it changes every 30s), **or**
> 2. One of the admin's backup codes, **or**
> 3. They can turn 2FA off first (Security page) so you sign in with the password only.
>
> You'll test setting up 2FA yourself in **Test 11**, so option 3 is the smoothest start.

### A quick note on "demo mode"
Where a real text message or payment would normally happen, the platform runs in **demo mode** and
shows you what you need on screen instead (e.g. the member login code appears in the page, premiums
are marked paid without a card, plan changes apply instantly). This is expected.

---

# Part A — Core platform

## 2. Partner dashboard

### Test 1 — Admin sign-in
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|1.1| From the marketing site click **Sign in** (or open `/login`) | The "Partner sign in" screen loads | ☐ | |
|1.2| Enter the admin email + password, click **Sign in** | If 2FA is on, a code prompt appears; enter the code from the owner | ☐ | |
|1.3| Complete sign-in | You land on the **Dashboard** with a left sidebar | ☐ | |
|1.4| Look at the sidebar | You can see (among others): Dashboard, **Inbox**, Members, Telemedicine, AI Health Assistant, Insurance, Claims, Analytics & reporting, WhatsApp & USSD, Partner Ecosystem, **Help & docs**, Security, **Billing & plan**, **Branding**, Single sign-on, API & webhooks, and **Admin Console** | ☐ | |

### Test 2 — Dashboard overview
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|2.1| Read the Dashboard page | Summary tiles show numbers (members, consultations, etc.) without errors | ☐ | |

### Test 3 — Members & bulk import
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|3.1| Click **Members** | A list of members appears (incl. Amaka Obi, Tunde Bello, etc.) | ☐ | |
|3.2| Click a member's name | Their detail page opens showing profile + any consultations/enrolments | ☐ | |
|3.3| Go back, click **Add member**, fill name + details, save | The new member appears in the list | ☐ | |
|3.4| Click **Import CSV**, then **Download template** | A CSV template downloads | ☐ | |
|3.5| Fill a couple of rows in the template (at least `fullName`), choose the file in the modal | A preview shows your rows, flagging any with problems | ☐ | |
|3.6| Click to import | A result says how many were inserted / skipped, and the members appear | ☐ | |

### Test 4 — Telemedicine
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|4.1| Click **Telemedicine** | A list of consultations loads | ☐ | |
|4.2| Book a consultation for **Amaka Obi** (pick a reason/mode) | The new consultation appears in the list | ☐ | |

### Test 5 — AI Health Assistant
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|5.1| Click **AI Health Assistant** | A chat/triage screen loads | ☐ | |
|5.2| Describe a symptom (e.g. "I have a sore throat and mild fever") and submit | You get a guidance response and a triage level (e.g. self-care / see a doctor) | ☐ | |

### Test 6 — Insurance & enrolment
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|6.1| Click **Insurance** | A catalog of plans loads | ☐ | |
|6.2| Enrol **Amaka Obi** into a plan | An enrolment is created for her | ☐ | |
|6.3| Start the premium checkout for that enrolment | In demo mode it confirms the premium is marked paid (no card needed) | ☐ | |

### Test 7 — Claims (log + adjudicate)
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|7.1| Click **Claims** | The claims page loads with status tabs (Submitted, Under review, …) | ☐ | |
|7.2| Click **New claim**, choose **Amaka Obi**, enter an amount + provider, submit | A new claim appears with a reference like `CLM-XXXXXX`, status **Submitted** | ☐ | |
|7.3| Open the claim, move it to **Under review**, then **Approved** | The status updates each time | ☐ | |
|7.4| Open a claim and try to skip straight from Submitted to Paid (if offered) | Illegal jumps are prevented / not offered | ☐ | |
|7.5| On reject, confirm a note is required | You can't reject without entering a reason | ☐ | |

### Test 8 — Analytics & reporting
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|8.1| Click **Analytics & reporting** | KPIs, a trend chart, and breakdown tables load | ☐ | |
|8.2| Change the window (6 / 12 / 24 months) | The figures/chart update | ☐ | |
|8.3| Click **Export CSV** on any table | A CSV file downloads | ☐ | |
|8.4| Click **Print / Save as PDF** | A clean printable report appears (no sidebar) | ☐ | |

*(The query-builder at the top of this page is covered in Test 27.)*

### Test 9 — WhatsApp & USSD simulators
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|9.1| Click **WhatsApp & USSD** | The page shows your organisation **join code** and two simulators | ☐ | |
|9.2| In the USSD simulator, follow the prompts (enter the join code, a name, gender, confirm) | It walks through the steps and ends by confirming a member was enrolled | ☐ | |
|9.3| Try the WhatsApp simulator similarly | The chat flow completes and confirms enrolment | ☐ | |

### Test 10 — Admin Console (platform admin)
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|10.1| Click **Admin Console** | A page with tabs: Organisations, Users, Insurance plans, Partners, Audit log | ☐ | |
|10.2| **Organisations** — create a test organisation (+ optional first admin) | It's created with a slug + join code | ☐ | |
|10.3| **Users** — create a user under an org, edit its role | Changes save | ☐ | |
|10.4| **Insurance plans** — create or edit a plan | Changes save | ☐ | |
|10.5| **Partners** — view the partner list across categories | The ecosystem list loads | ☐ | |
|10.6| **Audit log** — open it | A list of recent privileged actions (with actor + timestamp), including the things you just did | ☐ | |

### Test 11 — Security / Two-factor authentication
> If the owner turned 2FA off for your sign-in, do this on the admin account. Otherwise the owner
> can do it with you, or use any other dashboard account.

| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|11.1| Click **Security** in the sidebar | The two-factor authentication panel loads | ☐ | |
|11.2| Click **Set up 2FA** | A QR code (and a manual key) appears | ☐ | |
|11.3| Scan the QR with an authenticator app (Google/Microsoft Authenticator, Authy…) | The app shows a rotating 6-digit code | ☐ | |
|11.4| Enter the current code, click **Verify & enable** | Success — **10 backup codes** are shown once | ☐ | |
|11.5| Copy the backup codes, click Done | The panel shows 2FA is **on** | ☐ | |
|11.6| Sign out, then sign back in with the password | After the password you're now asked for a 6-digit code | ☐ | |
|11.7| Enter a code from the app | You're signed in | ☐ | |
|11.8| *(Optional)* Sign in again and use a **backup code** instead | It also works (each backup code works once) | ☐ | |

### Test 12 — Single sign-on page
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|12.1| Click **Single sign-on** | The SAML SSO configuration page loads, showing your Service Provider URLs | ☐ | |
|12.2| Note the Entity ID / ACS / login URLs | They contain your workspace slug (no errors) | ☐ | |

### Test 13 — API & webhooks (developer)
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|13.1| Click **API & webhooks** | The page shows the public API base URL + a sample request | ☐ | |
|13.2| Under **API keys**, create a key (give it a name) | A key starting `mk_live_…` is shown **once** — copy it | ☐ | |
|13.3| Under **Webhooks**, add an endpoint URL (use a free test URL from https://webhook.site) and pick events, add it | A signing secret (`whsec_…`) is shown once; the endpoint is listed | ☐ | |
|13.4| Click **Test** on the endpoint | It reports a ping was delivered, and your webhook.site page shows the incoming event | ☐ | |
|13.5| Back in the dashboard, adjudicate or create a claim (Test 7) | A `claim.*` event arrives at your webhook.site URL | ☐ | |
|13.6| *(Optional)* Revoke the key / delete the webhook | They're removed from the lists | ☐ | |

*(The **Console** tab on this page is covered in Test 28.)*

---

## 3. Member self-service portal

> 💡 To make this meaningful, use **Amaka Obi** — the member you enrolled (Test 6), booked a consult
> for (Test 4), and logged a claim for (Test 7). Her portal will then show real data. (The richer
> member-app screens — Care / AI symptom check / Profile — are covered in Test 31.)

### Test 14 — Member OTP sign-in
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|14.1| Open the **Member portal** URL | A "Sign in" screen asks for phone or email | ☐ | |
|14.2| Enter `amaka.obi@member.demo`, click **Send code** | The next screen appears; in demo mode the **code is shown on screen** | ☐ | |
|14.3| Confirm the code field is pre-filled (demo) or enter the shown code, click **Verify & sign in** | You land in the member portal | ☐ | |

### Test 15 — Member views their info
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|15.1| Read the **Home** tab | A health snapshot, **cover** (the plan you enrolled), and **recent care** (the consult you booked) | ☐ | |
|15.2| Click the **Claims** tab | The claim you logged for her is listed with its status | ☐ | |

### Test 16 — Member submits a claim
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|16.1| On the Claims tab, click **Submit a claim** | A form opens | ☐ | |
|16.2| Choose a type, enter a provider + amount, submit | The new claim appears in the member's list as **Submitted** | ☐ | |
|16.3| Sign out, go to the **partner dashboard → Claims** | The member-submitted claim is in the partner's queue too | ☐ | |

---

## 4. Provider portal — Doctor

### Test 17 — Doctor sign-in & queue
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|17.1| Open the **Provider portal** URL, sign in as the **doctor** | You land on a **Consultations** workspace | ☐ | |
|17.2| Look at the **Queue** tab | At least one waiting consultation is listed | ☐ | |

### Test 18 — Doctor handles a consult
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|18.1| Click a queued consultation | A panel opens showing the patient, reason, allergies & conditions | ☐ | |
|18.2| Click **Accept consultation** | It moves to in-progress and shows clinical fields | ☐ | |
|18.3| Enter a **diagnosis** and **notes** | Fields accept text | ☐ | |
|18.4| Under e-Prescriptions, add a medication. **In the Pharmacy field type `HealthPlus`**, then add it | The prescription appears in the list | ☐ | |
|18.5| Click **Complete consult** | The consultation moves to **Completed** | ☐ | |

---

## 5. Provider portal — Pharmacist

### Test 19 — Pharmacist dispenses
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|19.1| Sign out, sign back in as the **pharmacist** | You land on a **Dispensary** workspace | ☐ | |
|19.2| Look at the **To dispense** tab | Pending prescriptions are listed (incl. the one the doctor routed to HealthPlus, and a pre-loaded demo one) | ☐ | |
|19.3| Click **Mark dispensed** on a prescription | It moves to **Dispensed** | ☐ | |

---

## 6. Security & isolation spot-checks

### Test 20 — The three logins stay separate
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|20.1| While signed in to the **member** portal, manually visit the dashboard URL | You are **not** treated as staff — you're sent to the staff login | ☐ | |
|20.2| While signed in as a **provider**, manually visit the dashboard URL | Same — you're sent to the staff login | ☐ | |
|20.3| Sign out of each portal using its **Sign out** button | You're returned to that portal's login screen | ☐ | |

---

# Part B — SaaS features

## 7. Public marketing & pricing site (no login)

### Test 21 — Landing page
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|21.1| Open the **root** URL | A marketing site loads: dark hero, sticky top nav | ☐ | |
|21.2| Click the **audience tabs** (Insurers / Employers / Telcos) | The headline, copy and bullets swap for each | ☐ | |
|21.3| Scroll to **Pricing** | Four tiers; **Growth** badged "Most popular" | ☐ | |
|21.4| In **Book a demo**, enter a work email, click **Request demo** | A thank-you confirmation replaces the form | ☐ | |
|21.5| Click **Sign in** (top right) | You reach the partner login | ☐ | |

## 8. Onboarding & global helpers (admin)

### Test 22 — Onboarding checklist
> If your org completed all six steps or you dismissed the banner before, it won't show — that's
> correct behaviour.

| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|22.1| Land on the **Dashboard** | A "Get MobiCova live" banner with a **% progress ring** + 6-step checklist (if not all done/dismissed) | ☐ | |
|22.2| Click an **incomplete** step | It becomes active; the detail panel updates with its description + CTA | ☐ | |
|22.3| Click the step's **CTA button** | You navigate to the relevant page | ☐ | |
|22.4| Click **Dismiss setup ✕** | The banner disappears | ☐ | |

### Test 23 — Command palette (Ctrl+K / ⌘K)
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|23.1| Press **Ctrl + K** anywhere in the dashboard | A search palette opens | ☐ | |
|23.2| Type "claims" | Results filter to matching pages/actions | ☐ | |
|23.3| Press **Enter** (or click a result) | You navigate there; palette closes | ☐ | |
|23.4| Open again, press **Esc** | It closes | ☐ | |

### Test 24 — Help widget
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|24.1| Click the floating **?** button (bottom-right) | A help panel opens with suggestions for the current page | ☐ | |
|24.2| Click a suggestion | It navigates you there | ☐ | |
|24.3| Open again, click **Search all commands** | The ⌘K palette opens | ☐ | |

### Test 25 — Help & docs
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|25.1| Click **Help & docs** in the sidebar | A three-pane docs page (guides nav · article · on-this-page) | ☐ | |
|25.2| Click a different guide in the left nav | The article content swaps | ☐ | |

## 9. Inbox, analytics builder, API console

### Test 26 — Inbox / Action centre
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|26.1| Click **Inbox** in the sidebar (may show a number badge) | Stat cards (Urgent / To review / System / Done today) | ☐ | |
|26.2| Review the grouped action cards | Each has a title, detail, and action button(s) | ☐ | |
|26.3| Click an action (e.g. "Open claims") | You navigate to the relevant page | ☐ | |
|26.4| Back in Inbox, click **Mark all read** (if shown) | The sidebar unread badge clears | ☐ | |

### Test 27 — Analytics query builder
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|27.1| Open **Analytics & reporting** | A **query builder** sits at the top (Measure + Group by + result) | ☐ | |
|27.2| Change the **Measure** (e.g. Enrolments) and **Group by** (e.g. Plan) | The chart/figures recompute | ☐ | |
|27.3| Toggle **Chart / Table** | The view switches; the table shows % of total + a Total row | ☐ | |
|27.4| Click **Export CSV** (in the builder) | A CSV downloads | ☐ | |

### Test 28 — API console
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|28.1| Open **API & webhooks**, click the **Console** tab | An endpoint list + request bar + response area | ☐ | |
|28.2| Pick an endpoint (e.g. `/members`) and click **Send** | A `200 OK` and syntax-highlighted JSON (`{ data, pagination }`) appears | ☐ | |

## 10. Billing & white-label branding (admin)

### Test 29 — Billing & plan
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|29.1| Click **Billing & plan** in the sidebar | Plan banner, usage meters, plan tiers, invoices table | ☐ | |
|29.2| Read the **usage meters** | Real numbers (members, deliveries, intake) against plan limits | ☐ | |
|29.3| Click **Switch** on a different tier | The current plan updates (banner + highlighted tier change) | ☐ | |

### Test 30 — Branding (white-label)
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|30.1| Click **Branding** in the sidebar | A form on the left + a **live phone preview** on the right | ☐ | |
|30.2| Type a **Display name** | The preview's name updates as you type | ☐ | |
|30.3| Click a different **colour swatch** | The preview's header, cover and button recolour instantly | ☐ | |
|30.4| Click **Save changes** | A "✓ Saved" confirmation | ☐ | |
|30.5| Open the **member portal** and sign in (Test 31) | The member app's header/cover use your **new brand colour** | ☐ | |

## 11. Member app (mobile)

### Test 31 — Member app
> Use **Amaka Obi** (`amaka.obi@member.demo`).

| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|31.1| Open the **member portal**, sign in with the on-screen code | A mobile app with a **bottom tab bar** (Home / Care / Claims / Profile) | ☐ | |
|31.2| **Home** | Branded header, a cover card, stat tiles, "Submit a claim", recent care | ☐ | |
|31.3| **Care → AI symptom check** | A chat opens; type "I have a sore throat" and send | ☐ | |
|31.4| Wait for the reply | The AI assistant responds with guidance (and a "not a diagnosis" note) | ☐ | |
|31.5| **Claims → Submit a claim** | Fill type + amount, submit → it appears in the member's list | ☐ | |
|31.6| **Profile** | Health snapshot (blood group, allergies as tags), cover, **Sign out** | ☐ | |

---

# Part C — Unified organisation model (underwriters, companies, telcos, clinics, pharmacies)

These tests verify that **every business is an Organisation of a type**, all managed from one Platform
Admin Console, each administered individually with no cross-org visibility — and that care still flows
across orgs. Sign in as the **platform admin** (`admin@axamansard.demo`) unless a step says otherwise.

> Run `npm run seed` first so the demo clinic/pharmacy orgs + their admins exist.

## 13. Platform Admin Console — organisations by type

### Test 32 — Browse all organisations by type
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|32.1| Sign in as the platform admin → **Admin Console** → **Organisations** | A table of **all** organisations across the platform | ☐ | |
|32.2| Look at the **Type** column | Each org shows a friendly type label + a colour badge for its class (**demand** / **supply** / **integration**) | ☐ | |
|32.3| Use the **type filter** dropdown (top left), choose **Pharmacy** | The list narrows to pharmacy orgs only; the count updates ("X of Y") | ☐ | |
|32.4| Choose **All types** again | Full list returns | ☐ | |

### Test 33 — Onboard a new organisation
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|33.1| Click **+ Onboard organisation** | A dialog opens with name, country, **Organisation type** (all 10 types), plan tier, optional first admin | ☐ | |
|33.2| Create one of type **Pharmacy** (e.g. "Test Pharmacy"), add a first admin email + password | "Organisation created" confirmation; it appears in the list as a **supply** org | ☐ | |
|33.3| Note the absence of any new web address | There is **no new URL** — the new org's admin signs in at the same `/login` | ☐ | |

## 14. Supply-org admin — clinic & pharmacy dashboards

### Test 34 — Clinic admin dashboard
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|34.1| Sign out, then sign in at `/login` as `clinic@mobicova.demo` | You land on a **focused dashboard** for Helium Health | ☐ | |
|34.2| Look at the sidebar | Only supply items: **Dashboard, Staff, Help & docs, Security, Branding**. **No** Members/Claims/Insurance/Analytics | ☐ | |
|34.3| Read the dashboard | Cards show open **consultations** + doctor count, and a **consultation queue** routed to this clinic | ☐ | |
|34.4| Confirm the queue only shows this clinic's work | You see members' names + clinical context, but **no** claims/plan/billing data | ☐ | |

### Test 35 — Pharmacy admin dashboard
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|35.1| Sign out, sign in as `pharmacy@mobicova.demo` | Focused dashboard for HealthPlus | ☐ | |
|35.2| Read the dashboard | Cards show open **prescriptions** + pharmacist count, and a **prescription queue** routed to this pharmacy (medication, member, method, status) | ☐ | |

### Test 36 — Supply-org self-service staff
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|36.1| As the clinic admin, open **Staff** | A list of the clinic's doctors | ☐ | |
|36.2| Click **+ Add doctor**, fill name + email + password, save | The new doctor appears in the list as **active** | ☐ | |
|36.3| Click **Deactivate** on a doctor, then **Reactivate** | Status toggles between active/inactive | ☐ | |
|36.4| (Optional) Sign in at `/provider/login` as the doctor you just created | They can sign in to the Provider portal | ☐ | |

### Test 37 — Isolation check (no cross-org visibility)
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|37.1| While signed in as the clinic admin, there is no Members/Claims menu | Supply orgs cannot reach member-management workspaces | ☐ | |
|37.2| The queue/staff shown belong only to **this** organisation | No data from AXA Mansard, other clinics, or other pharmacies is visible | ☐ | |

## 15. Provider portal — multi-clinic switcher & org routing

### Test 38 — Clinic switcher (doctor in two clinics)
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|38.1| Sign in at `/provider/login` as `doctor@mobicova.demo` | The clinician portal loads | ☐ | |
|38.2| Look at the top bar | A **dropdown** shows the clinics the doctor belongs to (Helium Health, DrConsult) | ☐ | |
|38.3| Switch the dropdown to the other clinic | The consultation queue **refetches** and now reflects the selected clinic | ☐ | |

### Test 39 — Prescription routing on the org model
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|39.1| As the doctor, open a consult and **prescribe** a medicine; the **pharmacy** dropdown lists pharmacy **organisations** | You can pick e.g. HealthPlus | ☐ | |
|39.2| Sign out; sign in at `/provider/login` as `pharmacist@mobicova.demo` (HealthPlus) | The dispensary shows the prescription routed to HealthPlus | ☐ | |
|39.3| Sign in as the **member** (`amaka.obi@member.demo`) → **Care** | The prescription appears with pickup/delivery + tracking (from earlier fulfilment tests) | ☐ | |

---

## 16. Tester sign-off

| Item | Value |
|------|-------|
| Tester name | |
| Date | |
| Browser / device | |
| Total tests passed | ___ / 39 |
| Overall result (Pass / Pass with issues / Fail) | |

**Summary of any issues found** (list the test number and what went wrong; attach screenshots where
possible):

> _________________________________________________________________________________

---

### Cleanup note (for the site owner, after testing)
Testing creates demo records (a test member, claims, an enrolment, API key/webhook, a demo lead, and
a plan/branding change). None of it is harmful, but for a clean slate before an investor/insurer
demo: remove obviously-named test entries from **Members**, **Claims**, and **API & webhooks**; reset
the tier on **Billing** and colours on **Branding**; and remove the test organisation/user from the
**Admin Console**. Demo leads are stored server-side and are harmless.
