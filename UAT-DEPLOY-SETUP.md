# UAT deployment — setup guide (main → UAT auto-deploy)

How the pieces fit:

```
push to main ─▶ GitHub Actions (.github/workflows/uat.yml)
                  │  build + type-check server & client   ← the gate
                  ▼ (only if green)
              Render deploy hooks ─▶ mobicova-uat-api  (preDeploy: npm run migrate)
                                  └▶ mobicova-uat-web
```

CI is the gate — a broken build never reaches UAT. Migrations run automatically
before each API release via `preDeployCommand`.

---

## One-time setup

### 1. UAT database (isolated from prod)
- Create a **separate Supabase project** for UAT. Copy its pooled connection string.
- It will be migrated automatically on first deploy (`preDeployCommand: npm run migrate`).

### 2. Create the two Render services
Render auto-reads `render.yaml`; this repo keeps UAT in **`render.uat.yaml`** so prod
config stays separate. Create the UAT services using those settings — either:
- **Dashboard:** New → Web Service (API, `rootDir: server`) and New → Static Site
  (web, `rootDir: client`), copying the build/start/health/preDeploy/env settings from
  `render.uat.yaml`; or
- **Dedicated Blueprint/workspace:** point a Render Blueprint at a branch where
  `render.uat.yaml` is the active `render.yaml`.

Name them `mobicova-uat-api` and `mobicova-uat-web`, both tracking **`main`**, with
**Auto-Deploy = Off** (CI triggers them).

### 3. Set environment variables (TEST / sandbox only)
On `mobicova-uat-api`, set every `sync: false` var from `render.uat.yaml` to a **test**
value so UAT never charges money or messages real people:
- `DATABASE_URL` → the UAT Supabase string
- `STRIPE_SECRET_KEY` / `PAYSTACK_SECRET_KEY` → **test** keys
- `RESEND_API_KEY` + `EMAIL_FROM` → test/sandbox domain
- `ANTHROPIC_API_KEY` → a key with a **low budget cap**
- WhatsApp vars → leave unset to use the **built-in simulator**, or a sandbox number
- `CLIENT_URL` → `https://mobicova-uat-web.onrender.com`
- `PLATFORM_ADMIN_EMAILS` → your admin email(s)

`APP_ENV=uat` and `JWT_SECRET` (auto-generated) are already in the blueprint.

### 4. Wire the deploy hooks into GitHub
- In each Render service: **Settings → Deploy Hook** → copy the URL.
- In GitHub: **Settings → Secrets and variables → Actions → New repository secret**:
  - `RENDER_DEPLOY_HOOK_API` = the API service hook URL
  - `RENDER_DEPLOY_HOOK_WEB` = the web service hook URL

### 5. Seed synthetic data (one-off)
Against the UAT database, run `npm run seed` (from `server/`) to load demo orgs, members
and accounts. Re-run any time to reset UAT to a known-good state.

### 6. Point channel webhooks at UAT (optional)
If testing live channels, set the WhatsApp / Africa's Talking webhooks to the UAT API URL
(`https://mobicova-uat-api.onrender.com/...`) using **sandbox** numbers/shortcodes.

---

## Day-to-day

- Open a PR → CI builds + type-checks it (no deploy).
- Merge to `main` → CI runs again; on green it fires both deploy hooks → UAT updates,
  migrations applied automatically.
- Promote to **Production** by tagging a release (`vX.Y`) once partners sign off in UAT —
  Production is provisioned separately on AWS af-south-1 (see the production plan).

## Simpler alternative (no CI gate)
If you'd rather skip the gate, set **Auto-Deploy = On** and `branch: main` on the two
services and delete the `deploy-uat` job from the workflow — Render then redeploys on every
push to `main`. Trade-off: a broken build can deploy. The gated setup above is recommended.

## Optional follow-up
The client reads `VITE_APP_ENV`; a small banner component keyed off `VITE_APP_ENV === 'uat'`
makes the "UAT — not live" strip appear automatically. Happy to add it on request.
