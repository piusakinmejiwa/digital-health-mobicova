# MobiCova Health — High-Availability Design (within the primary site)

How the platform stays online when a **single component fails** — an app node, the
database server, the cache, a load balancer. This is **HA** (seconds-to-minutes,
automatic, on the Nobus primary). It is distinct from **DR** (`DR-RUNBOOK.md`),
which handles the rare loss of the *whole* Nobus site (~30–45 min, cross-cloud to
AWS). Most "incidents" are component failures — HA is what you rely on day to day.

> Status: design intent. The concrete database-HA build depends on Nobus's
> managed-vs-self-managed answer (questionnaire B1) — both paths are specified below.

---

## 1. Principle — no single point of failure

Every tier runs **≥2 instances across separate failure domains** (racks / power /
hypervisors — confirm Nobus's options, questionnaire E1/B3). Failures are
**detected automatically** (health checks) and **recovered automatically**
(reroute + promote + restart). The application is **stateless and crash-only**, so
a failed node is simply replaced, never repaired in place.

## 2. Per-component design & recovery

### Load balancer
- Run a **redundant LB** — Nobus's LB service, or **2× HAProxy/Nginx with a virtual
  IP (keepalived)** so the VIP floats to the survivor.
- Health-checks each app node on **`/healthz`** (dependency-free liveness — so a DB
  blip never culls healthy app nodes) and stops routing to an unhealthy one.
- **Recovery: seconds, automatic.**

### App tier (Node/Express API)
- **≥2 stateless containers/VMs** across racks, behind the LB.
- The app holds **no local state** (JWT sessions + a Redis-backed active-session
  check that *fails open*), so any node serves any request.
- On a node death: the LB reroutes in **~10–30s** (check interval × threshold); the
  orchestrator restarts/reschedules the node. **Zero user-visible downtime** with ≥2 nodes.
- **Recovery: seconds, automatic.**

### Database (PostgreSQL) — the critical one
Needs a **primary + a hot standby with automatic failover**. Two paths:

**Path A — Nobus managed PostgreSQL (preferred, if offered).** Their service runs
the standby + automatic failover + a stable endpoint; on primary loss it promotes
the standby and the endpoint now points at it. **Recovery ~30–120s, automatic** —
nothing for us to operate. *(This is why questionnaire B1 is decisive.)*

**Path B — self-managed cluster on VMs.** A 3-node Postgres cluster managed by
**Patroni + a DCS (etcd/Consul)** for leader election, fronted by **HAProxy (or a
VIP)** so the app's connection string always reaches the current leader:
- Replication: **synchronous to ≥1 standby** (RPO = 0 for a node failure), with a
  second standby (or quorum) so a single standby outage doesn't stall writes.
- On primary failure: Patroni detects and **promotes a standby in ~10–40s**; HAProxy
  repoints; the app's connection pool reconnects automatically.
- **Recovery ~10–40s, automatic** — but we operate the cluster (patching, monitoring).

Either way the app reaches the DB through **one stable address** (managed endpoint or
HAProxy/VIP) — never a hard-coded node — so failover is transparent to the code.

### Cache / sessions (Redis)
- **Redis with Sentinel** (or the Nobus managed equivalent): a replica + automatic
  failover. On loss, Sentinel promotes the replica.
- Lower stakes than the DB — sessions re-issue and the cache rebuilds — so even a
  brief outage degrades gracefully rather than failing the platform.
- **Recovery: seconds–a minute, automatic.**

### Object storage (claim docs / images)
- Use Nobus's **redundant/replicated storage tier** (confirm internal redundancy,
  questionnaire C). Not a compute node — no failover for us to run.

## 3. Failure → recovery summary

| Failure | Detection | Recovery | Downtime | Automatic? |
|---|---|---|---|---|
| App node dies | LB `/healthz` | LB reroutes + node restarts | ~0 (with ≥2 nodes) | ✅ |
| Load balancer node dies | VIP / LB health | VIP floats to survivor | seconds | ✅ |
| **DB primary dies** | Patroni / managed | standby promoted, endpoint repoints | **~10–120s** | ✅ |
| Redis dies | Sentinel | replica promoted | seconds–1 min | ✅ |
| A whole rack dies | all of the above | survivors carry load | seconds–~2 min | ✅ |
| **Whole Nobus site dies** | external probes | **DR → AWS** (`DR-RUNBOOK.md`) | ~30–45 min | manual trigger |

## 4. Application resilience (already in place / to ensure)

- **Stateless API + crash-only:** a node can die and be replaced freely. The DB pool
  exits the process on a fatal connection error → the orchestrator restarts it →
  it reconnects to the new leader. Pair this with auto-restart + the LB on `/healthz`.
- **Health probes built in:** `/healthz` (liveness, no deps) for the LB; `/readyz`
  (DB ping) for readiness/monitoring. Use **liveness for load-balancer health** so a
  DB failover doesn't pull every app node out at once.
- **To ensure during build:** sensible DB connection-pool timeouts + retry on a
  transient failover blip; idempotent writes where a request may be retried.

## 5. Minimum topology

- **2+ app nodes**, **2 LB nodes** (or a redundant LB service), across **≥2 racks**.
- Database: **managed HA**, or a **3-node Patroni cluster** (so quorum survives one
  loss) + the DCS.
- **1 Redis primary + 1 replica** with Sentinel.
- All spread across independent failure domains (confirm rack/power separation).

## 6. Test it — failure drills

HA that isn't drilled is a guess. Quarterly (and after changes):
1. Kill an app node → confirm no user impact, node returns.
2. **Kill the DB primary → confirm automatic promotion** and that the app keeps
   serving within the target window. *(The most important drill.)*
3. Kill a Redis node → confirm Sentinel failover.
4. Pull a rack → confirm survivors carry load.

## 7. How HA and DR fit together

- **HA (this doc):** component failure on Nobus → automatic, seconds–minutes, no data loss.
- **DR (`DR-RUNBOOK.md`):** whole Nobus site lost → cross-cloud to AWS, ~30–45 min,
  RPO ~minutes, manual trigger.

Together they cover the full spectrum. **The one decision that unlocks the HA build
is Nobus B1 — managed PostgreSQL (Path A) vs self-managed Patroni (Path B).** Get
that answer and this becomes a concrete build.
