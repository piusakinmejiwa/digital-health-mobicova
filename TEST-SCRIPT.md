# MobiCova — Manual Test Script (UAT)

A click-by-click script for a tester to verify the live MobiCova platform. No technical
knowledge needed — just a web browser. Work top to bottom; some later tests rely on data
created in earlier ones.

- **Estimated time:** 60–90 minutes for the full pass.
- **How to record results:** for each step, mark the **Result** column **Pass** or **Fail**.
  If it fails, write what you saw in **Notes** (and a screenshot helps).

---

## 1. Before you start

### Test environment
| What | Where |
|------|-------|
| Partner dashboard | https://mobicova-client.onrender.com |
| Member portal | https://mobicova-client.onrender.com/member/login |
| Provider portal | https://mobicova-client.onrender.com/provider/login |

> ⏳ **First load may take ~30 seconds.** The server sleeps when idle and wakes on the first
> request. If a page is slow or a button seems stuck the very first time, wait and retry once.

### Logins
| Role | Email | Password |
|------|-------|----------|
| Partner **admin** | `admin@axamansard.demo` | `password123` |
| Provider — **doctor** | `doctor@mobicova.demo` | `password123` |
| Provider — **pharmacist** | `pharmacist@mobicova.demo` | `password123` |
| **Member** (portal) | `amaka.obi@member.demo` | *no password — uses a one-time code* |

> 🔐 **Important — the admin account has two-factor authentication (2FA) switched on.**
> When you sign in as the admin you'll be asked for a 6-digit code after the password.
> **The site owner must give you one of these to start:**
> 1. The current 6-digit code from their authenticator app (it changes every 30s), **or**
> 2. One of the admin's backup codes, **or**
> 3. They can turn 2FA off first (Security page) so you sign in with the password only.
>
> You'll test setting up 2FA yourself later (Test 11), so option 3 is the smoothest start.

### A quick note on "demo mode"
Where a real text message or payment would normally happen, the platform runs in **demo mode**
and shows you what you need on screen instead (e.g. the member login code appears in the page,
premiums are marked paid without a card). This is expected.

---

## 2. Partner dashboard

### Test 1 — Admin sign-in
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|1.1| Open the dashboard URL | The "Partner sign in" screen loads | ☐ | |
|1.2| Enter the admin email + password, click **Sign in** | If 2FA is on, a code prompt appears; enter the code from the owner | ☐ | |
|1.3| Complete sign-in | You land on the **Dashboard** with a left sidebar | ☐ | |
|1.4| Look at the sidebar | You can see: Dashboard, Members, Telemedicine, AI Health Assistant, Insurance, Claims, Analytics & reporting, WhatsApp & USSD, Partner Ecosystem, Security, Single sign-on, API & webhooks, and **Admin Console** | ☐ | |

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
|10.6| **Audit log** — open it | A list of recent privileged actions (with actor + timestamp) is shown, including the things you just did | ☐ | |

### Test 11 — Security / Two-factor authentication
> If the owner turned 2FA off for your sign-in, do this on the admin account. Otherwise the
> owner can do it with you, or you can use any other dashboard account.

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

---

## 3. Member self-service portal

> 💡 To make this meaningful, use **Amaka Obi** — the member you enrolled (Test 6), booked a
> consult for (Test 4), and logged a claim for (Test 7). Her portal will then show real data.

### Test 14 — Member OTP sign-in
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|14.1| Open the **Member portal** URL | A "Sign in" screen asks for phone or email | ☐ | |
|14.2| Enter `amaka.obi@member.demo`, click **Send code** | The next screen appears; in demo mode the **code is shown on screen** | ☐ | |
|14.3| Confirm the code field is pre-filled (demo) or enter the shown code, click **Verify & sign in** | You land in the member portal | ☐ | |

### Test 15 — Member views their info
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|15.1| Read the **Overview** tab | You see a health snapshot, **My cover** (the plan you enrolled), and **Recent care** (the consult you booked) | ☐ | |
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
|19.2| Look at the **To dispense** tab | Pending prescriptions are listed (incl. the one the doctor just routed to HealthPlus, and a pre-loaded demo one) | ☐ | |
|19.3| Click **Mark dispensed** on a prescription | It moves to **Dispensed** | ☐ | |

---

## 6. Security & isolation spot-checks

### Test 20 — The three logins stay separate
| # | Step | Expected result | Result | Notes |
|---|------|-----------------|:------:|-------|
|20.1| While signed in to the **member** portal, manually visit the dashboard URL | You are **not** treated as staff — you're sent to the staff login (member access doesn't unlock the dashboard) | ☐ | |
|20.2| While signed in as a **provider**, manually visit the dashboard URL | Same — you're sent to the staff login | ☐ | |
|20.3| Sign out of each portal using its **Sign out** button | You're returned to that portal's login screen | ☐ | |

---

## 7. Tester sign-off

| Item | Value |
|------|-------|
| Tester name | |
| Date | |
| Browser / device | |
| Total tests passed | ___ / 20 |
| Overall result (Pass / Pass with issues / Fail) | |

**Summary of any issues found:**

> _(List the test number and what went wrong. Attach screenshots where possible.)_

---

### Cleanup note (for the site owner, after testing)
Testing creates demo records (a test member, claims, an enrolment, API key/webhook, etc.).
None of it is harmful, but if you want a clean slate before an investor/insurer demo, remove the
tester's obviously-named test entries from the **Members**, **Claims**, and **API & webhooks**
pages, and the test organisation/user from the **Admin Console**.
