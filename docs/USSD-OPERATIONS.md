# USSD Operations Runbook

Everything needed to keep MobiCova's USSD channel healthy, detect outages fast, and
fix the two ways it actually breaks. Written after the 2026-07 outage.

---

## How we diagnosed the outage (so the reasoning is repeatable)

We probed production live. Results:

| Check | Result | Meaning |
|---|---|---|
| `GET /healthz` | **timed out ~25s, then woke on retry** | The service had **gone to sleep** (cold start) |
| `GET /readyz` | `200 {"status":"ok","db":true}` | Server + database are healthy |
| `POST /api/v1/channels/ussd` (empty `text`) | `200 CON Welcome to MobiCova…` | **The USSD engine itself works** |

Conclusion: the backend is **not** broken — a synthetic dial returns the correct
opening menu. That leaves exactly two causes, both external to the app code:

1. **Cold starts** — the host sleeps when idle; the first dial after idle exceeds the
   telco's USSD timeout. (Prime suspect — see the 25s `/healthz` wake above.)
2. **Africa's Talking callback config** — AT isn't reaching the working endpoint
   (stale URL after the domain move, or the service code isn't live).

> Rule of thumb: **self-test green + real dials failing ⇒ the fault is AT/telco-side**,
> not the app. The self-test (Step 1) makes this a one-glance check.

---

## Step 1 — Deploy the monitor + alerting

**What it is.** A deep health probe plus a scheduled pinger:

- `GET /api/v1/channels/ussd/selftest` runs a synthetic opening dial through the *real*
  engine (route → controller → DB). Returns `200 {"ok":true,"ms":…,"requiresToken":…}`
  when healthy, `503` when broken. Side-effect free, exposes no data. This is what
  `/healthz` and `/readyz` **don't** do — they never touch the USSD path.
- `.github/workflows/ussd-monitor.yml` pings it **every 5 minutes** (with one retry so a
  transient blip doesn't page anyone). On failure it posts a 🚨 message to your platform
  Slack channel; the failed run also shows in the Actions tab and emails the repo owner.

**Deploy it:**

1. `git push origin main`.
2. In GitHub: **repo → Settings → Secrets and variables → Actions → New repository secret**:
   - `PLATFORM_SLACK_WEBHOOK_URL` — your ops Slack Incoming Webhook (required for the alert).
   - `API_BASE_URL` — optional; defaults to `https://api.mobicovahealth.com`.
3. Confirm it runs: **Actions tab → USSD Monitor → Run workflow** (don't wait 5 min for the
   first scheduled run). A green run = healthy; trigger it any time to spot-check.

**Verify the endpoint yourself:**
```bash
curl -s https://api.mobicovahealth.com/api/v1/channels/ussd/selftest
# -> {"ok":true,"ms":42,"requiresToken":false}
```

**Caveat on timing.** GitHub scheduled workflows can be **delayed 5–15 min** under load, so
treat this as *alerting + partial keep-warm*, not sub-minute detection. For tighter
detection and a public status page, also point **UptimeRobot (free, 5-min)** or **Better
Stack (30s)** at the same `/ussd/selftest` URL — no code change needed.

---

## Step 2 — Fix the Africa's Talking callback URL

The exact, live, verified webhook path is:

```
https://api.mobicovahealth.com/api/v1/channels/ussd
```

In the **Africa's Talking dashboard → USSD → Service Codes** (or *Create Channel*):

1. Open your service code and check the **Callback URL** field. It must match the path
   above **exactly**. The most likely bug after your domain move is that it still points
   at an old `…onrender.com` host — update it.
2. Optional second callback, **end-of-session notification URL**:
   `https://api.mobicovahealth.com/api/v1/channels/ussd/notification`
3. Confirm the **service code is live/provisioned** — a production dedicated code has to be
   pushed live by the telcos (MTN/Airtel/Glo/9mobile); a sandbox code only works in AT's
   simulator.
4. Confirm the **AT account has credits** and isn't suspended.

**Test after changing:** use AT's USSD simulator, or dial the code on a real phone. If the
`selftest` is green but dials still fail, the remaining fault is here (URL/service code).

---

## Step 3 — Make the API always-on (kill cold starts)

**Why USSD is uniquely sensitive.** Telco USSD gateways expect a reply in roughly
**5–10 seconds** or they drop the session. A warm server answers in milliseconds (proven
in our probe), but a host that sleeps when idle takes **20–30s to cold-start** on the first
dial after a quiet spell → the telco times out → the user sees *"USSD not working."*
Intermittent, worst during low-traffic periods.

**Fix options, best first:**

1. **Always-on hosting.** On Render, run the API on an instance tier that does **not sleep**
   (Starter or higher); if already paid, make sure it isn't undersized. This is the real
   fix — cold starts simply can't happen.
2. **External keep-warm ping.** If you must stay on a sleeping tier for now, point an
   **UptimeRobot / Better Stack** check at `/healthz` every **≤14 minutes** (the host sleeps
   at ~15 min idle). This is more reliable for warmth than the GitHub monitor, whose runs
   can be delayed.
3. **Permanent fix via the Nobus migration.** The in-Nigeria hosting spec already calls for
   always-on FCS VMs (no sleep) — this removes cold starts for good once you cut over.

> The Step 1 monitor helps keep the service warm as a side effect, but because GitHub cron
> timing isn't guaranteed, don't rely on it alone for warmth — use option 1 or 2.

---

## Step 4 — Lock the webhook (`AT_WEBHOOK_TOKEN`)

**Why.** Our probe reached the endpoint with **no token**, so the USSD webhook is currently
open to the internet. A valid organisation join code is still required to actually enrol a
member, so this isn't a data-leak — but it's needless abuse surface (anyone can drive the
menu / spam enrolment attempts). The server now logs a startup warning while it's unset.

**Lock it (a few minutes):**

1. Generate a random token:
   ```bash
   openssl rand -hex 24
   ```
2. Set it on the API host — **Render → your service → Environment**:
   `AT_WEBHOOK_TOKEN=<the value>` — then redeploy/restart.
3. In the **AT dashboard**, append `?token=<the value>` to **both** callback URLs:
   ```
   https://api.mobicovahealth.com/api/v1/channels/ussd?token=<value>
   https://api.mobicovahealth.com/api/v1/channels/ussd/notification?token=<value>
   ```
4. Verify: a request **without** the token now returns `403 END Unauthorised`; AT's requests
   (with the token) work normally.

The code already enforces this — `atTokenOk()` in `ussd.controller.ts` does a constant-time
compare and is a no-op until the token is set, so enabling it never breaks a live code.

---

## Quick reference

| Thing | Value |
|---|---|
| USSD webhook (POST) | `https://api.mobicovahealth.com/api/v1/channels/ussd` |
| End-of-session notification (POST) | `…/api/v1/channels/ussd/notification` |
| Self-test (GET) | `…/api/v1/channels/ussd/selftest` → `{"ok":true,…}` |
| Liveness / Readiness | `/healthz` · `/readyz` |
| Monitor workflow | `.github/workflows/ussd-monitor.yml` (every 5 min) |
| Required secret | `PLATFORM_SLACK_WEBHOOK_URL` (+ optional `API_BASE_URL`) |
| Security env | `AT_WEBHOOK_TOKEN` (append `?token=…` to AT URLs) |
