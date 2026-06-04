import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getInbox, markInboxRead } from '../../api/inbox';
import type { InboxItem } from '../../types';
import { formatDateTime } from '../../lib/format';
import './Inbox.css';

const GROUPS: { key: 'urgent' | 'review' | 'system'; label: string }[] = [
  { key: 'urgent', label: '⚠ Urgent' },
  { key: 'review', label: 'To review' },
  { key: 'system', label: 'System' },
];

const actionVerb = (a: string) =>
  a.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function InboxPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['inbox'], queryFn: getInbox });

  const markAll = async () => {
    if (!data) return;
    await markInboxRead(data.items.map((i) => i.key));
    qc.invalidateQueries({ queryKey: ['inbox'] });
  };

  const act = async (item: InboxItem, href: string) => {
    await markInboxRead([item.key]);
    qc.invalidateQueries({ queryKey: ['inbox'] });
    navigate(href);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Action centre</h1>
          <p>Everything that needs a decision, in one queue.</p>
        </div>
        {data && data.unread > 0 && (
          <button className="btn btn-secondary" onClick={markAll}>Mark all read</button>
        )}
      </div>

      {isLoading || !data ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <div className="ac-stats">
            <div className="ac-stat urgent"><b>{data.counts.urgent}</b><span>Urgent</span></div>
            <div className="ac-stat"><b>{data.counts.review}</b><span>To review</span></div>
            <div className="ac-stat"><b>{data.counts.system}</b><span>System</span></div>
            <div className="ac-stat"><b>{data.counts.doneToday}</b><span>Done today</span></div>
          </div>

          {data.items.length === 0 && (
            <div className="card card-pad"><p className="muted">🎉 You’re all caught up — nothing needs attention right now.</p></div>
          )}

          {GROUPS.map((g) => {
            const groupItems = data.items.filter((i) => i.group === g.key);
            if (groupItems.length === 0) return null;
            return (
              <div key={g.key}>
                <div className="section-label">{g.label}</div>
                {groupItems.map((item) => (
                  <div key={item.key} className={`action-card ${item.severity === 'crit' ? 'crit' : item.severity === 'urgent' ? 'urgent' : ''} ${item.read ? 'is-read' : ''}`}>
                    <div className={`ac-icon ${item.icon}`}>{item.icon === 'red' ? '!' : item.icon === 'amber' ? '₦' : item.icon === 'blue' ? '▦' : '✓'}</div>
                    <div className="ac-body">
                      <div className="ac-title">{item.title}</div>
                      <div className="ac-meta">{item.meta}</div>
                      <div className="ac-actions">
                        {item.actions.map((a) => (
                          <button key={a.label} className="btn btn-sm btn-secondary" onClick={() => act(item, a.href)}>{a.label}</button>
                        ))}
                        {!item.read && (
                          <button className="btn btn-sm btn-link" onClick={async () => { await markInboxRead([item.key]); qc.invalidateQueries({ queryKey: ['inbox'] }); }}>Dismiss</button>
                        )}
                      </div>
                    </div>
                    <div className="ac-time">{formatDateTime(item.createdAt)}</div>
                  </div>
                ))}
              </div>
            );
          })}

          {data.done.length > 0 && (
            <>
              <div className="section-label">Done today</div>
              <div className="card card-pad">
                <ul className="feed">
                  {data.done.map((d, i) => (
                    <li key={i}>
                      <span className="ft">{new Date(d.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                      <span><b>{actionVerb(d.action)}</b>{d.target_label ? ` · ${d.target_label}` : ''}{d.actor_email ? ` · ${d.actor_email}` : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
