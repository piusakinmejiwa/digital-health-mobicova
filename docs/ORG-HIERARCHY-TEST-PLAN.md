# Org Hierarchy — Test Plan

How to verify the Insurer → HMO → Employer → Member work end to end. Run this on
**staging or local — not production** (it creates test orgs/members). See
`docs/ORG-HIERARCHY-DESIGN.md` for the model.

---

## 1. Automated tests (regression net — already green)

```bash
cd server && npm test          # 100 tests, incl:
#   orgHierarchy.test.ts   — the coverage-chain clause logic (own/offered/underwritten)
#   http/members-phi       — HMO is now a PHI owner
#   http/hierarchy         — HMO console gate (403 company / 200 hmo) + assignable plans
```

These use a **mocked database**, so they prove the *logic and wiring* — not the live
coverage chain against real rows. That's what the manual pass below is for.

---

## 2. Manual end-to-end (the real test)

Reminder: the coverage chain is **dormant until you link orgs into a tree and give plans an
owner**. So the setup below is what "turns it on".

### Setup — as a PLATFORM ADMIN

1. **Admin Console → Organisations** — create three orgs, provisioning an admin user
   (set a password) for each so you can log in as them:
   - `Test Insurer` — type **Insurance company (underwriter)**
   - `Test HMO` — type **HMO**, **Parent = Test Insurer**
   - (employers come next, via the HMO itself)
2. **Admin Console → Plans → New plan** — `Test Bronze`, premium ₦5,000,
   **Kind = Group**, **Offered by (HMO) = Test HMO**, **Underwritten by = Test Insurer**.

### Setup — as the TEST HMO ADMIN (log in with that user)

3. **Employers** (new sidebar item) → **Onboard employer** twice: `Employer A` and
   `Employer B`, each with an admin user.
4. For each employer, click **Plans** → assign **Test Bronze**:
   - Employer A: negotiated premium **₦4,000**
   - Employer B: leave blank (uses the ₦5,000 list price)
5. Add a member or two per employer (Members → Add member) — give at least one a
   **date of birth + a condition** (for the PHI check). Enrol them in Test Bronze
   from the Insurance page.

### Verify — expected results

| # | Do this | Expect |
|---|---|---|
| A | **Members** page as the **HMO** | **Both** employers' members appear (the whole book) |
| B | Members page as **Employer A** admin | **Only** Employer A's members |
| C | Open a member **profile** as the **HMO** | DOB + conditions **visible** (`phiRestricted:false`) |
| D | Same profile as an **Employer** admin | PHI **stripped** (`phiRestricted:true`) |
| E | Log a claim on an Employer A member, then **Claims** as the **HMO** | Claim shows; you can **Approve/Reject** it |
| F | Claims as **Employer B** admin | That claim is **not** visible |
| G | **Dashboard** as the **HMO** | Monthly premium ≈ **₦9,000** (₦4,000 + ₦5,000 — negotiated, not 2×₦5,000) |
| H | Dashboard as **Employer A** | Premium reflects **₦4,000** (its negotiated rate) |
| I | Any unrelated **company** org | Sees only itself — **unchanged** |

### Quick shortcut for A/B/E/F (row scope only)

Platform admin → Organisations → **View as org** on the HMO (whole book) vs an employer
(its own). Fast, no extra logins. **Caveat:** PHI won't strip under View-as (the viewer is
a platform admin) — use a real **employer** login for C/D.

---

## 3. Cleanup

Delete the test orgs (cascades to their members, enrolments, assignments, claims) and the
test plan:

```sql
DELETE FROM organisations WHERE slug LIKE 'test-%' OR name LIKE 'Test %';
DELETE FROM insurance_plans WHERE name = 'Test Bronze';
```

(Slugs are auto-generated from the names, so `Test HMO` → `test-hmo` etc.)
