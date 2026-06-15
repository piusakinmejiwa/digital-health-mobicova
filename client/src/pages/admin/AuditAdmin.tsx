import { useQuery } from '@tanstack/react-query';
import type { AuditEntry } from '../../types';
import { adminListAudit } from '../../api/admin';
import { actionMeta, auditWhen } from '../../lib/auditLabels';

export default function AuditAdmin() {
  const { data: entries, isLoading } = useQuery({
    queryKey: ['admin-audit'],
    queryFn: () => adminListAudit(),
  });

  return (
    <div className="card">
      <div className="admin-toolbar">
        <span className="muted small">
          {isLoading ? 'Loading…' : `${entries?.length ?? 0} most recent events`}
        </span>
        <span className="muted small">Append-only · read-only</span>
      </div>
      <table className="table">
        <thead>
          <tr><th>When</th><th>Action</th><th>Target</th><th>Organisation</th><th>By</th></tr>
        </thead>
        <tbody>
          {entries?.map((e: AuditEntry) => {
            const m = actionMeta(e.action);
            return (
              <tr key={e.id}>
                <td className="muted small" style={{ whiteSpace: 'nowrap' }}>{auditWhen(e.created_at)}</td>
                <td><span className={`badge ${m.tone}`}>{m.label}</span></td>
                <td>{e.target_label || <span className="muted small">{e.target_id || '—'}</span>}</td>
                <td className="muted small">{e.org_name || '—'}</td>
                <td className="muted small">{e.actor_email || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!isLoading && (!entries || entries.length === 0) && (
        <p className="empty-state">No activity recorded yet. Admin actions will appear here.</p>
      )}
    </div>
  );
}
