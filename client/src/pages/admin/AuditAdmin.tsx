import { useQuery } from '@tanstack/react-query';
import type { AuditEntry } from '../../types';
import { adminListAudit } from '../../api/admin';

// Human-readable label + colour band for each action verb.
const ACTION_META: Record<string, { label: string; tone: string }> = {
  'org.create': { label: 'Organisation created', tone: 'badge-green' },
  'org.update': { label: 'Organisation updated', tone: 'badge-blue' },
  'org.suspend': { label: 'Organisation suspended', tone: 'badge-gray' },
  'org.reactivate': { label: 'Organisation reactivated', tone: 'badge-green' },
  'org.delete': { label: 'Organisation deleted', tone: 'badge-red' },
  'user.create': { label: 'User created', tone: 'badge-green' },
  'user.update': { label: 'User updated', tone: 'badge-blue' },
  'user.activate': { label: 'User activated', tone: 'badge-green' },
  'user.deactivate': { label: 'User deactivated', tone: 'badge-gray' },
  'user.reset_password': { label: 'Password reset', tone: 'badge-blue' },
  'user.delete': { label: 'User deleted', tone: 'badge-red' },
  'plan.create': { label: 'Plan created', tone: 'badge-green' },
  'plan.update': { label: 'Plan updated', tone: 'badge-blue' },
  'plan.delete': { label: 'Plan deleted', tone: 'badge-red' },
  'partner.create': { label: 'Partner created', tone: 'badge-green' },
  'partner.update': { label: 'Partner updated', tone: 'badge-blue' },
  'partner.delete': { label: 'Partner deleted', tone: 'badge-red' },
};

function meta(action: string) {
  return ACTION_META[action] ?? { label: action, tone: 'badge-gray' };
}

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

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
            const m = meta(e.action);
            return (
              <tr key={e.id}>
                <td className="muted small" style={{ whiteSpace: 'nowrap' }}>{when(e.created_at)}</td>
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
