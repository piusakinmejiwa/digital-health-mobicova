import { useQuery } from '@tanstack/react-query';
import type { AuditEntry } from '../../types';
import { getOrgActivity } from '../../api/activity';
import { actionMeta, auditWhen } from '../../lib/auditLabels';

// Partner-facing activity log: every notable action in the admin's OWN
// organisation — members added/enrolled, staff changes, claims, sign-ins.
export default function ActivityPage() {
  const { data: entries, isLoading } = useQuery({ queryKey: ['org-activity'], queryFn: getOrgActivity });

  return (
    <div className="page">
      <div className="page-head">
        <h1>Activity log</h1>
        <p className="muted">
          What&rsquo;s happening in your organisation — members, staff, claims and sign-ins. Read-only.
        </p>
      </div>

      <div className="card">
        <div className="admin-toolbar">
          <span className="muted small">{isLoading ? 'Loading…' : `${entries?.length ?? 0} recent events`}</span>
          <span className="muted small">Append-only · read-only</span>
        </div>
        <table className="table">
          <thead>
            <tr><th>When</th><th>Action</th><th>Detail</th><th>By</th></tr>
          </thead>
          <tbody>
            {entries?.map((e: AuditEntry) => {
              const m = actionMeta(e.action);
              return (
                <tr key={e.id}>
                  <td className="muted small" style={{ whiteSpace: 'nowrap' }}>{auditWhen(e.created_at)}</td>
                  <td><span className={`badge ${m.tone}`}>{m.label}</span></td>
                  <td>{e.target_label || <span className="muted small">{e.target_type || '—'}</span>}</td>
                  <td className="muted small">{e.actor_email || 'Self-service'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!isLoading && (!entries || entries.length === 0) && (
          <p className="empty-state">No activity recorded yet. Actions in your organisation will appear here.</p>
        )}
      </div>
    </div>
  );
}
