# MobiCova — USSD Tester Walkthrough

**Member self-service over USSD · Tester guide**

MobiCova Health · June 2026

---

## What you're testing

The MobiCova member menu over USSD on a Nigerian mobile phone — checking your cover, claims and prescriptions, requesting a doctor callback, viewing your rewards, and the free Health Buddy tips. The guide also covers what a brand-new caller sees (enrolment).

## Before you start

- **Service code to dial:** `____________________`  *(provided by MobiCova)*
- **Your phone:** a Nigerian mobile number that MobiCova has **registered as a member**, so you see the member menu. If your number is not registered, you will see the *enrolment* screen instead — that is steps 9–10 below.
- **Member web app** (optional, to cross-check the same account on a browser): `https://mobicovahealth.com/member/login`
- Each menu choice **ends the session** (USSD shows one answer at a time) — simply **re-dial** the code for the next test.
- Replies should appear within about **5 seconds**.
- Note your **network** (MTN, Glo, Airtel or 9mobile) on the sign-off — USSD can behave differently per network.

## Test steps

| # | What to do | What you should see | Pass? |
|---|---|---|---|
| 1 | Dial the service code | "Hi {your name}! MobiCova member services" with options: **1** My cover · **2** My claims · **3** My prescriptions · **4** Request a doctor callback · **5** My rewards · **0** Health Buddy | ☐ |
| 2 | Re-dial, reply **1** | Your active cover (plan, status, premium) — or "No active cover on record." | ☐ |
| 3 | Re-dial, reply **2** | Your recent claims — or "No claims on record." | ☐ |
| 4 | Re-dial, reply **3** | Your prescriptions and their status — or "No prescriptions on record." | ☐ |
| 5 | Re-dial, reply **4** | "Thanks {your name}! A MobiCova doctor will call you back shortly." | ☐ |
| 6 | Re-dial, reply **5** | "MobiCova Rewards" with your Points, Streak and Badges | ☐ |
| 7 | Re-dial, reply **0** | Health Buddy topic list (Fever, Malaria, Sore throat, Hydration, Headache…) | ☐ |
| 8 | From step 7, reply **2** (Malaria) | A short malaria health tip | ☐ |
| 9 | Ask MobiCova to test with an **unregistered** number | "Welcome to MobiCova. Reply with your organisation code to enrol…" | ☐ |
| 10 | From step 9, reply a valid **organisation code** | Enrolment begins (asks for your details) | ☐ |

## If something is wrong

Write down: the **step number**, exactly what you **dialled or replied**, and the **exact words** on the screen — then send it back to MobiCova. A photo of the screen helps.

## Sign-off

| Field | |
|---|---|
| Tester name | |
| Date | |
| Network (MTN / Glo / Airtel / 9mobile) | |
| Handset model | |
| Overall result (Pass / Fail) | |

---

*MobiCova Health — connecting members to care, live, on any device.*
