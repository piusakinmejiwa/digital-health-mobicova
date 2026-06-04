# MobiCova — Manual Test Script: SaaS Features (Phases 1–4)

A click-by-click script for a tester to verify the **newer SaaS features** added on top of the core
platform: the public marketing site, onboarding, command palette & help, help-&-docs, inbox,
analytics query builder, API console, billing, white-label branding, and the polished member app.

> This **complements** `TEST-SCRIPT.md` (which covers the core platform: members, telemedicine,
> claims, analytics, admin, 2FA, SSO, API keys, provider portal, etc.). Run that one too for full
> coverage.

- **Estimated time:** 35–50 minutes.
- **How to record results:** mark each step **Pass** or **Fail**; on a failure, note what you saw.

---

## 1. Before you start

| What | Where |
|------|-------|
| Public marketing site | https://mobicova-client.onrender.com/ (the **root** URL) |
| Partner dashboard | sign in from the site, or go to `/dashboard` |
| Member portal | https://mobicova-client.onrender.com/member/login |

| Role | Email | Password |
|------|-------|----------|
| Partner **admin** | `admin@axamansard.demo` | `password123` |
| **Member** (portal) | `amaka.obi@member.demo` | *one-time code (shown on screen)* |

> 🔐 **The admin account has 2FA on.** After the password you'll be asked for a 6-digit code — the
> site owner must provide their authenticator code/backup code, or turn 2FA off first (Security page).
>
> 🆕 **The root URL `/` is now the public marketing site**, not the dashboard. Use **Sign in** (top
> right) to reach the app. Once signed in you land on `/dashboard`.
>
> 💡 **Demo mode:** member login codes appear on screen; plan changes apply instantly; the demo form
> just records a lead. All expected.
>
> ⏳ First load may take ~30s while the server wakes.

---

## 2. Public marketing & pricing site (no login)

### Test 1 — Landing page
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|1.1| Open the **root** URL | A marketing site loads: dark hero "Health cover, telemedicine & AI triage…", sticky top nav | ☐ | |
|1.2| Click the **audience tabs** (Insurers / Employers / Telcos) | The headline, copy and bullet list swap for each | ☐ | |
|1.3| Scroll to **Pricing** | Four tiers (Starter/Growth/Scale/Enterprise); **Growth** badged "Most popular" | ☐ | |
|1.4| In **Book a demo**, enter a work email (+ optional company/type), click **Request demo** | A thank-you confirmation replaces the form | ☐ | |
|1.5| Click **Sign in** (top right) | You're taken to the partner login | ☐ | |

---

## 3. Dashboard onboarding & global helpers (sign in as admin)

### Test 2 — Onboarding checklist
> If your demo org already completed all six steps (or you dismissed it before), the banner won't
> show — that's correct behaviour. The owner can re-show it by clearing the dismiss flag.

| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|2.1| Land on the **Dashboard** | A teal "Get MobiCova live" banner with a **% progress ring** and a 6-step checklist appears (if not all done/dismissed) | ☐ | |
|2.2| Click an **incomplete** step | It becomes active; the right-hand detail panel updates with its description + CTA | ☐ | |
|2.3| Click the step's **CTA button** | You're navigated to the relevant page (e.g. Insurance, Members) | ☐ | |
|2.4| Return to Dashboard, click **Dismiss setup ✕** | The banner disappears | ☐ | |

### Test 3 — Command palette (⌘K)
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|3.1| Press **Ctrl + K** (⌘K on Mac) anywhere in the dashboard | A search palette opens | ☐ | |
|3.2| Type "claims" | Results filter to matching pages/actions | ☐ | |
|3.3| Press **Enter** (or click a result) | You navigate to that page; palette closes | ☐ | |
|3.4| Open it again, press **Esc** | It closes | ☐ | |

### Test 4 — Help widget
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|4.1| Click the floating **?** button (bottom-right) | A help panel opens with suggestions for the current page | ☐ | |
|4.2| Click a suggestion | It navigates you there | ☐ | |
|4.3| Open it again, click **Search all commands** | The ⌘K palette opens | ☐ | |

### Test 5 — Help & docs
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|5.1| Click **Help & docs** in the sidebar | A three-pane docs page (guides nav · article · on-this-page) | ☐ | |
|5.2| Click a different guide in the left nav | The article content swaps | ☐ | |

---

## 4. Inbox, analytics builder, API console

### Test 6 — Inbox / Action centre
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|6.1| Click **Inbox** in the sidebar (may show a number badge) | An action centre with stat cards (Urgent / To review / System / Done today) | ☐ | |
|6.2| Review the grouped action cards | Items have a title, detail, and action button(s) | ☐ | |
|6.3| Click an action (e.g. "Open claims") | You navigate to the relevant page | ☐ | |
|6.4| Back in Inbox, click **Mark all read** (if shown) | The sidebar unread badge clears | ☐ | |

### Test 7 — Analytics query builder
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|7.1| Open **Analytics & reporting** | A **query builder** sits at the top (Measure + Group by + result) | ☐ | |
|7.2| Change the **Measure** (e.g. Enrolments) and **Group by** (e.g. Plan) | The chart/figures recompute | ☐ | |
|7.3| Toggle **Chart / Table** | The view switches; the table shows % of total + a Total row | ☐ | |
|7.4| Click **Export CSV** | A CSV downloads | ☐ | |

### Test 8 — API console
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|8.1| Open **API & webhooks**, click the **Console** tab | An endpoint list + request bar + response area | ☐ | |
|8.2| Pick an endpoint (e.g. `/members`) and click **Send** | A `200 OK` and syntax-highlighted JSON (`{ data, pagination }`) appears | ☐ | |

---

## 5. Billing & white-label branding (admin)

### Test 9 — Billing & plan
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|9.1| Click **Billing & plan** in the sidebar | Plan banner, usage meters, plan tiers, invoices table | ☐ | |
|9.2| Read the **usage meters** | Real numbers (members, deliveries, intake) against plan limits | ☐ | |
|9.3| Click **Switch** on a different tier | The current plan updates (banner + highlighted tier change) | ☐ | |

### Test 10 — Branding (white-label)
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|10.1| Click **Branding** in the sidebar | A form on the left + a **live phone preview** on the right | ☐ | |
|10.2| Type a **Display name** | The preview's name updates as you type | ☐ | |
|10.3| Click a different **colour swatch** | The preview's header, cover and button recolour instantly | ☐ | |
|10.4| Click **Save changes** | A "✓ Saved" confirmation | ☐ | |
|10.5| Open the **member portal** (`/member/login`) and sign in (Test 11) | The member app's header/cover use your **new brand colour** | ☐ | |

---

## 6. Member app (mobile)

### Test 11 — Member app
> Use **Amaka Obi** (`amaka.obi@member.demo`) — enrol her / log a claim from the dashboard first if
> you want her portal populated.

| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|11.1| Open the **member portal**, sign in with the on-screen code | A mobile app with a **bottom tab bar** (Home / Care / Claims / Profile) | ☐ | |
|11.2| **Home** | Branded header, a cover card, stat tiles, "Submit a claim", recent care | ☐ | |
|11.3| **Care → AI symptom check** | A chat opens; type "I have a sore throat" and send | ☐ | |
|11.4| Wait for the reply | The AI assistant responds with guidance (and a "not a diagnosis" note) | ☐ | |
|11.5| **Claims → Submit a claim** | Fill type + amount, submit → it appears in the member's list | ☐ | |
|11.6| **Profile** | Health snapshot (blood group, allergies as tags), cover, **Sign out** | ☐ | |

---

## 7. Tester sign-off

| Item | Value |
|------|-------|
| Tester name | |
| Date | |
| Browser / device | |
| Tests passed | ___ / 11 |
| Overall (Pass / Pass with issues / Fail) | |

**Issues found** (test # + what went wrong; screenshots help):

> _________________________________________________________________

---

### Cleanup note (site owner)
Testing creates a demo lead (marketing form), maybe a member-submitted claim, and a plan/branding
change. None are harmful, but before an investor demo you can: reset the plan tier on **Billing**,
reset colours on **Branding**, and remove any obvious test claims. Demo leads are stored server-side
(`demo_leads`) — harmless.
