import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  getNotifications, markNotificationsRead, markAllNotificationsRead, timeAgo,
  type Notification,
} from '../../api/notifications';
import './NotificationBell.css';

const SEV_DOT: Record<string, string> = { info: 'teal', warn: 'amber', critical: 'red' };

// Floating notifications bell (top-right) shown on every signed-in page. Polls
// the per-user feed and opens a dropdown of recent items.
export default function NotificationBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications(12),
    refetchInterval: 60000,
  });
  const unread = data?.unread || 0;
  const items = data?.items || [];

  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] });

  const openItem = async (n: Notification) => {
    setOpen(false);
    if (!n.read) { await markNotificationsRead([n.id]); refresh(); }
    if (n.href) navigate(n.href);
  };
  const markAll = async () => { await markAllNotificationsRead(); refresh(); };

  return (
    <div className="notif-bell-wrap">
      <button className="notif-bell" aria-label="Notifications" onClick={() => setOpen((o) => !o)}>
        <span aria-hidden>🔔</span>
        {unread > 0 && <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <>
          <div className="notif-backdrop" onClick={() => setOpen(false)} />
          <div className="notif-pop" role="dialog" aria-label="Notifications">
            <div className="notif-pop-head">
              <strong>Notifications</strong>
              <div className="notif-pop-head-actions">
                {unread > 0 && <button className="notif-link" onClick={markAll}>Mark all read</button>}
                <button className="notif-link" title="Notification settings"
                  onClick={() => { setOpen(false); navigate('/settings/notifications'); }}>⚙</button>
              </div>
            </div>

            <div className="notif-list">
              {items.length === 0 ? (
                <p className="notif-empty">You’re all caught up.</p>
              ) : items.map((n) => (
                <button key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`} onClick={() => openItem(n)}>
                  <span className={`notif-dot ${SEV_DOT[n.severity] || 'teal'}`} />
                  <span className="notif-item-body">
                    <span className="notif-item-title">{n.title}</span>
                    {n.body && <span className="notif-item-sub">{n.body}</span>}
                    <span className="notif-item-time">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              ))}
            </div>

            <button className="notif-viewall" onClick={() => { setOpen(false); navigate('/notifications'); }}>
              View all notifications
            </button>
          </div>
        </>
      )}
    </div>
  );
}
