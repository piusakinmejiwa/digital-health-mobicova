import { Request } from 'express';
import { query } from '../config/database';

// Records privileged / notable actions to the append-only audit_log. Best-effort:
// any failure here is logged and swallowed so auditing can never break the action
// it is recording. Call AFTER the action has succeeded.

// Route params type as string | string[] under the project's Express types, so
// the id-bearing fields accept that union and are normalised below.
type Scalarish = string | string[] | undefined | null;

export interface AuditInput {
  action: string;        // dot-namespaced verb, e.g. 'org.suspend'
  targetType?: string;   // 'organisation' | 'user' | 'member' | 'claim' | …
  targetId?: Scalarish;
  targetLabel?: Scalarish; // name/email for human-readable display
  orgId?: Scalarish;
  metadata?: Record<string, unknown>;
}

function str(v: Scalarish): string | null {
  if (v == null) return null;
  return Array.isArray(v) ? v.join(',') : v;
}

// Low-level append with explicit actor/org fields. Use this for events that
// happen WITHOUT an authenticated staff request — logins (req.user isn't set
// yet) and self-service channel enrolments (USSD/WhatsApp — no req at all).
export async function writeAudit(f: {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  orgId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log
         (actor_user_id, actor_email, action, target_type, target_id, target_label, org_id, metadata, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        f.actorId ?? null,
        f.actorEmail ?? null,
        f.action,
        f.targetType ?? null,
        f.targetId ?? null,
        f.targetLabel ?? null,
        f.orgId ?? null,
        JSON.stringify(f.metadata ?? {}),
        (f.ip ?? '').toString().slice(0, 64),
      ]
    );
  } catch (err) {
    // Never throw — auditing is observational, not part of the transaction.
    console.error('audit log write failed:', err);
  }
}

// Audit an action performed by the authenticated staff user on `req`.
export async function recordAudit(req: Request, input: AuditInput): Promise<void> {
  const actorId = req.user?.userId ?? null;
  let actorEmail: string | null = null;
  if (actorId) {
    try {
      const r = await query('SELECT email FROM users WHERE id = $1', [actorId]);
      actorEmail = r.rows[0]?.email ?? null;
    } catch {
      /* ignore — best effort */
    }
  }
  const ip = (req.ip || req.headers['x-forwarded-for'] || '').toString().slice(0, 64);
  await writeAudit({
    actorId,
    actorEmail,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: str(input.targetId),
    targetLabel: str(input.targetLabel),
    orgId: str(input.orgId),
    metadata: input.metadata,
    ip,
  });
}
