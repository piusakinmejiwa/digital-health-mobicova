import { Request } from 'express';
import { query } from '../config/database';

// Records a privileged action to the append-only audit_log. Best-effort: any
// failure here is logged and swallowed so auditing can never break the action
// it is recording. Call AFTER the action has succeeded.

// Route params type as string | string[] under the project's Express types, so
// the id-bearing fields accept that union and are normalised below.
type Scalarish = string | string[] | undefined | null;

interface AuditInput {
  action: string;        // dot-namespaced verb, e.g. 'org.suspend'
  targetType?: string;   // 'organisation' | 'user' | 'plan' | 'partner'
  targetId?: Scalarish;
  targetLabel?: Scalarish; // name/email for human-readable display
  orgId?: Scalarish;
  metadata?: Record<string, unknown>;
}

function str(v: Scalarish): string | null {
  if (v == null) return null;
  return Array.isArray(v) ? v.join(',') : v;
}

export async function recordAudit(req: Request, input: AuditInput): Promise<void> {
  try {
    const actorId = req.user?.userId ?? null;
    let actorEmail: string | null = null;
    if (actorId) {
      const r = await query('SELECT email FROM users WHERE id = $1', [actorId]);
      actorEmail = r.rows[0]?.email ?? null;
    }
    // Express sets req.ip; fall back to the forwarded header behind a proxy.
    const ip = (req.ip || req.headers['x-forwarded-for'] || '').toString().slice(0, 64);

    await query(
      `INSERT INTO audit_log
         (actor_user_id, actor_email, action, target_type, target_id, target_label, org_id, metadata, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        actorId,
        actorEmail,
        input.action,
        input.targetType ?? null,
        str(input.targetId),
        str(input.targetLabel),
        str(input.orgId),
        JSON.stringify(input.metadata ?? {}),
        ip,
      ]
    );
  } catch (err) {
    // Never throw — auditing is observational, not part of the transaction.
    console.error('audit log write failed:', err);
  }
}
