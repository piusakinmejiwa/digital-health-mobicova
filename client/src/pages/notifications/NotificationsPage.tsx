import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  getNotifications, markNotificationsRead, markAllNotificationsRead, timeAgo,
  type Notification,
} from '../../api/notifications';

const SEV_DOT: Record<string, string> = { info: 'teal', warn: 'amber', critical: 'red' };

// Full notifications feed (the bell's "View all" target).
export default function NotificationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['notifications-page'], queryFn: () => getNotifications(100) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['notifications-page'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  const open = async (n: Notification) => {
    if (!n.read) { await markNotificationsRead([n.id]); refresh(); }
    if (n.href) navigate(n.href);
  };
  const markAll = async () => { await markAllNotificationsRead(); refresh(); };

  const items = data?.items || [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Notifications</h1>
          <p>Activity across your organisation. Manage what you receive in <Link to="/settings/notifications">notification settings</Link>.</p>
        </div>
        {(data?.unread || 0) > 0 && <button className="btn btn-secondary" onClick={markAll}>Mark all read</button>}
      </div>

      <div className="card">
        {isLoading ? (
          <p className="muted" style={{ padding: 20 }}>Loading…</p>
        ) : items.length === 0 ? (
          <p className="empty-state">No notifications yet. As claims come in, reports run and usage changes, you’ll see them here.</p>
        ) : (
          <div>
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => open(n)}
                style={{
                  display: 'flex', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer',
                  padding: '14px 18px', border: 'none', borderBottom: '1px solid #f2f5f4',
                  background: n.read ? 'none' : '#f1faf8',
                }}
              >
                <span className={`notif-dot ${SEV_DOT[n.severity] || 'teal'}`} style={{ marginTop: 7 }} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, color: '#11302e' }}>{n.title}</span>
                  {n.body && <span className="small" style={{ color: '#5a6a68' }}>{n.body}</span>}
                  <span className="muted small" style={{ textTransform: 'capitalize' }}>{n.category} · {timeAgo(n.created_at)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
