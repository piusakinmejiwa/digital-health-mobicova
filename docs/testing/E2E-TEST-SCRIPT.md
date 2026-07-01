# MobiCova Health — End-to-End Test Script

**Purpose:** a single walkthrough a tester can follow to confirm the whole platform works as intended before the AXA Mansard go-live.
**How to use:** work top to bottom. For each step, tick **Pass** or **Fail** and add a note. Anything that fails → log it using the Bug Report template at the end.

> Tester: ____________________  Date: __________  Build/commit: __________  Browser + device: ____________________

---

## 0. Before you start (prerequisites)

Fill these in with the person running the test. Do **not** test against real patient data.

| Item | Value for this run |
|---|---|
| Environment URL (frontend) | e.g. `https://mobicovahealth.com` or the onrender staging URL |
| API URL | e.g. `https://api.mobicovahealth.com` |
| Test **organisation** (name / slug) | |
| Organisation **join code** | e.g. `660670` |
| Staff **admin** login (email / pwd) | |
| Staff **manager** login | |
| Staff **analyst** (read-only) login | |
| **Platform admin** login | |
| Test **member** (has email + phone) | |
| Test **doctor** login (provider) | |
| Test **pharmacist** login (provider) | |
| USSD code (if testing live) | `*347*559#` |
| A test **CSV** of 3–5 members (with 1 email, 1 phone-only) | |

**General checks that apply to every page (spot-check as you go):**
- [ ] Page loads with no blank screen / console errors (open DevTools → Console).
- [ ] MobiCova branding/logo is present; nothing looks like placeholder/"lorem ipsum".
- [ ] The padlock shows a valid certificate (no "Not secure").
- [ ] Layout is not broken on a phone-width window (test a few key pages at ~390px).

---

## 1. Public / marketing site

- [ ] **1.1** Home page `/` loads; primary nav links work (Pricing, About, Partners, Contact, Channels, Telemedicine, Insurance, Developers, Blog).
- [ ] **1.2** `/pricing` shows plans; `/trust` (and `/security`) shows the trust/compliance content.
- [ ] **1.3** `/status` shows live system status (should reflect a real DB ping, not a static "all good").
- [ ] **1.4** `/changelog` and `/integrations` load.
- [ ] **1.5** `/blog` lists posts; opening a post (`/blog/:slug`) renders correctly with its cover image.
- [ ] **1.6** `/health-tips` public tip subscription page loads; a sign-up submits without error.
- [ ] **1.7** `/privacy`, `/cookies`, `/ai` policy pages load.
- [ ] **1.8** Cookie/consent banner (if shown) can be declined; declining sticks on reload.

## 2. Chatbots — Ask Eze & Health Buddy

- [ ] **2.1** On any public page, the **"Ask Eze"** launcher (bottom-right) shows the **MobiCova logo** (not a generic chat icon).
- [ ] **2.2** Open it — the panel header shows the **MobiCova logo + "MobiCova Health"** sub-label, and each assistant reply has a small **MobiCova avatar**.
- [ ] **2.3** Ask *"What is MobiCova?"* → a helpful answer that **includes a clickable in-site link** (e.g. to /pricing or /register).
- [ ] **2.4** Ask a **medical** question (e.g. *"I have a headache and fever"*) → Eze declines to diagnose and **offers/links to the Health Buddy**.
- [ ] **2.5** Go to `/buddy` → **8 buddy cards** shown; the page opens **directly in "General Health"** by default.
- [ ] **2.6** Buddy chat replies show the **MobiCova avatar** beside each answer, plus source links, and a "not a diagnosis" disclaimer.
- [ ] **2.7** `/ask` full page shows the **MobiCova logo** next to the "Ask Eze" title and avatars on replies.

## 3. Organisation sign-up & staff sign-in

- [ ] **3.1** `/register` — create a new test organisation; you land in the dashboard as its admin.
- [ ] **3.2** Sign out, then `/login` — sign in again with those credentials.
- [ ] **3.3** **Wrong password** → generic "Invalid email or password" (does **not** reveal whether the email exists).
- [ ] **3.4** **Forgot password (staff):** click **"Forgot password?"** on `/login` → enter the admin email → success message ("if that email has an account…").
- [ ] **3.5** Open the reset email → click the link → set a **new password (≥12 chars)** → redirected to sign in → sign in with the **new** password works.
- [ ] **3.6** After a reset, any **other** existing session for that user is signed out (if you were logged in elsewhere, it now asks you to sign in again).
- [ ] **3.7** (If MFA enabled for the account) the second-factor step appears and works; backup code works once.
- [ ] **3.8** (If SSO configured for the org) "Sign in with SSO" reaches the IdP and returns you signed in.

## 4. Staff dashboard — members & PHI gating

- [ ] **4.1** Open **Members** — list loads. As an **analyst (read-only)**, the list shows **no PHI** (no conditions/DOB/phone in the table).
- [ ] **4.2** As **admin/manager**, open a member profile → PHI fields (DOB, phone, conditions) are visible and you can **scroll to the bottom** of the edit form.
- [ ] **4.3** **Add a member** with an email → saved; you receive a **branded welcome email** from the org (from `org@mobicovahealth.com`, org name as sender) — *check the test inbox*.
- [ ] **4.4** A **new-member in-app notification** appears in the bell feed ("New member added").
- [ ] **4.5** Add a **phone-only** member → an in-app notification fires; SMS/WhatsApp welcome is queued (won't deliver until those channels are live — confirm no error).
- [ ] **4.6** Search + filter on the members list work.

## 5. Staff dashboard — CSV import & the welcome toggle

- [ ] **5.1** Members → **Import CSV** → choose the test CSV → **"Validate (dry run)"** → preview shows how many would import + any skipped rows, and **how many would get an email vs SMS/WhatsApp**.
- [ ] **5.2** The **"Send a welcome message to imported members"** checkbox is present and **ticked by default**.
- [ ] **5.3** Import **with the box ticked** → members created; the ones with an email receive a branded welcome (check inbox); an in-app "N members imported" notification appears.
- [ ] **5.4** Re-import a different small CSV **with the box unticked** → members created but **no welcome emails sent**.
- [ ] **5.5** (Platform admin) The same import + toggle works from **Admin Console → Organisation → Import** tab.

## 6. Staff dashboard — claims

- [ ] **6.1** Create a claim for a member → it appears in the claims list with the correct status.
- [ ] **6.2** Move a claim through its lifecycle (submitted → under review → approved/declined) — status transitions behave correctly.
- [ ] **6.3** Upload a claim document (receipt/scan) → it attaches and can be opened via a signed link.
- [ ] **6.4** (If AI claim review is on) the "AI verified / flagged" indicator shows on claims.

## 7. Staff dashboard — the rest of the menu

- [ ] **7.1** **Providers/Doctors** tab lists doctors; search/filter work.
- [ ] **7.2** **Reports** — trigger/preview a report; a branded report email is produced (check inbox if email is on).
- [ ] **7.3** **Notifications** — the bell feed shows recent events; opening the prefs page lets you toggle categories.
- [ ] **7.4** **Billing / Usage** — the usage widget shows member seat usage; the member seat cap is enforced (importing past the cap is blocked with an upgrade prompt).
- [ ] **7.5** **Branding** — upload an org logo; it appears where org branding is used.
- [ ] **7.6** **Developer** — create an API key (shown once) + a webhook endpoint; the "test" button on the webhook works.
- [ ] **7.7** **Security → Active sessions** — you can see this device; **"sign out other devices"** works.
- [ ] **7.8** **Compliance/Trust** tab — accept a DPA; request a data export.

## 8. Member enrolment channels

- [ ] **8.1** On `/channels`, the **WhatsApp** and **USSD** simulators run the enrolment flow end-to-end (enter join code → name → confirm → enrolled).
- [ ] **8.2** (If testing live USSD) dial **`*347*559#`** on the test line → menu appears → enrol with the join code → "enrolled" confirmation.
- [ ] **8.3** After a USSD/WhatsApp **self-enrolment**, the org gets an in-app **"New member enrolled via USSD/WHATSAPP"** notification, and the member is queued for an SMS/WhatsApp welcome (gated).
- [ ] **8.4** A self-enrolled member then appears in the staff **Members** list.

## 9. Member portal

- [ ] **9.1** `/member/login` — enter the test member's phone/email → **"Send code"**.
- [ ] **9.2** **"Didn't get it? Resend code"** re-sends; **"Use a different number or email"** returns to the first step.
- [ ] **9.3** Enter the code → signed in to the member home.
- [ ] **9.4** Wrong code is rejected; too many wrong codes are blocked.
- [ ] **9.5** **Overview / cover** shows the member's plan; **Claims** — submit a claim from the member side.
- [ ] **9.6** **Care / Doctors** list loads; start a **video consultation** (if `DAILY_API_KEY` is live) or see the graceful demo fallback.
- [ ] **9.7** **Rewards** — points/streaks/challenges/leaderboard/catalogue load; a redemption works.
- [ ] **9.8** **Prescriptions** — set a pickup/delivery method; tracking view updates.
- [ ] **9.9** **Profile** — update address; **"Sign out"** works; **"Sign out of all devices"** signs you out and (if you had a second session) that one is invalidated too.

## 10. Provider portal (doctor & pharmacist)

- [ ] **10.1** `/provider/login` — sign in as the test **doctor**.
- [ ] **10.2** **Forgot password (provider):** `/provider/forgot-password` → email → reset link → new password → sign in works.
- [ ] **10.3** Doctor sees the **consultations** queue; accept a consultation; start the call; add notes/prescription.
- [ ] **10.4** Sign in as **pharmacist** → **dispensary** queue; advance a prescription through fulfilment.
- [ ] **10.5** If the provider belongs to more than one clinic/pharmacy, the **org switcher** changes the visible queues.
- [ ] **10.6** Provider **"Sign out"** and **"All devices"** both work.

## 11. Platform Admin console (platform admins only)

- [ ] **11.1** Admin console is only reachable by a **platform admin** (a normal org admin cannot see it).
- [ ] **11.2** **Organisations** — list/create/suspend; a **suspended** org's users can't sign in (message shown only after a correct password).
- [ ] **11.3** **Users / Providers / Partners** tabs — CRUD works; you can't lock yourself out of your own admin.
- [ ] **11.4** **View-as / impersonate** an org works and is clearly indicated.
- [ ] **11.5** **Audit log** records the actions you just performed.

## 12. Cross-cutting checks

- [ ] **12.1 Tenant isolation:** with two test orgs, confirm Org A's admin **cannot** see Org B's members/claims (try editing a URL id if you can — it should 404/deny).
- [ ] **12.2 Responsive:** members table, member portal, and buddy chat are usable at phone width.
- [ ] **12.3 Error states:** submitting an empty/invalid form shows a friendly message, not a crash.
- [ ] **12.4 Health:** `GET {API}/healthz` returns 200; `GET {API}/readyz` returns 200 (503 only if the DB is down).
- [ ] **12.5 Session integrity:** after "sign out", using the browser back button does **not** get you back into a protected page.

---

## Bug report template (copy per issue)

```
ID:            BUG-___
Area / step:   (e.g. 5.3 CSV import welcome)
Severity:      Blocker / High / Medium / Low
Environment:   URL + browser + device
Steps to reproduce:
  1.
  2.
Expected:
Actual:
Screenshot/video:  (attach)
Console errors:    (paste if any)
```

**Severity guide:** *Blocker* = can't proceed / data loss / security. *High* = core journey broken. *Medium* = works but wrong. *Low* = cosmetic.

---

## Sign-off

| Area | Pass | Fail | Tester initials |
|---|---|---|---|
| 1 Public site | | | |
| 2 Chatbots | | | |
| 3 Sign-in & password reset | | | |
| 4 Members & PHI | | | |
| 5 CSV import | | | |
| 6 Claims | | | |
| 7 Dashboard menu | | | |
| 8 Enrolment channels | | | |
| 9 Member portal | | | |
| 10 Provider portal | | | |
| 11 Admin console | | | |
| 12 Cross-cutting | | | |

**Overall result:** ☐ Ready for demo   ☐ Ready with minor issues   ☐ Not ready
**Notes / blockers:** ____________________________________________
