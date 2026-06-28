import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MemberListItem } from '../../types';
import { formatDate } from '../../lib/format';
import './MembersTable.css';

// A member with 5+ lifetime consults is flagged for case management.
const HIGH_UTILISATION = 5;

const channelLabel: Record<string, string> = {
  app: 'App', web: 'Web', whatsapp: 'WhatsApp', ussd: 'USSD',
};
const channelClass: Record<string, string> = {
  app: 'ch-app', whatsapp: 'ch-whatsapp', ussd: 'ch-ussd', web: 'ch-web',
};
const statusClass: Record<string, string> = {
  active: 'st-active', inactive: 'st-inactive', pending: 'st-pending',
};

function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

interface MemberFlags { conditions: boolean; highUtil: boolean; pending: boolean; }
function flagsFor(m: MemberListItem): MemberFlags {
  return {
    conditions: m.has_conditions,
    highUtil: (m.consultation_count ?? 0) >= HIGH_UTILISATION,
    pending: m.status === 'pending',
  };
}

const JOINED_WINDOWS: Record<string, number> = { '7': 7, '30': 30, '90': 90, '365': 365 };

export default function MembersTable({
  members, canWrite, onRemove,
}: {
  members: MemberListItem[];
  canWrite: boolean;
  onRemove: (m: MemberListItem) => void;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [channel, setChannel] = useState('');
  const [plan, setPlan] = useState('');
  const [flag, setFlag] = useState('');
  const [joined, setJoined] = useState('');

  // Filter option lists are derived from the data so they only ever offer values
  // that actually exist for this organisation.
  const planOptions = useMemo(
    () => Array.from(new Set(members.map((m) => m.plan_name).filter(Boolean) as string[])).sort(),
    [members],
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(members.map((m) => m.status).filter(Boolean))).sort(),
    [members],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoff = joined && JOINED_WINDOWS[joined]
      ? Date.now() - JOINED_WINDOWS[joined] * 86_400_000
      : null;
    return members.filter((m) => {
      if (status && m.status !== status) return false;
      if (channel && m.channel !== channel) return false;
      if (plan && m.plan_name !== plan) return false;
      if (flag) {
        const f = flagsFor(m);
        if (flag === 'conditions' && !f.conditions) return false;
        if (flag === 'high_util' && !f.highUtil) return false;
        if (flag === 'pending' && !f.pending) return false;
      }
      if (cutoff !== null && new Date(m.created_at).getTime() < cutoff) return false;
      if (!q) return true;
      return [m.full_name, m.membership_id].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [members, search, status, channel, plan, flag, joined]);

  const view = (m: MemberListItem) => navigate(`/members/${m.id}`);
  const edit = (m: MemberListItem) => navigate(`/members/${m.id}?edit=1`);

  return (
    <div className="members-table-wrap">
      <div className="mt-filters">
        <input
          className="mt-search" type="search" value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or member ID…" aria-label="Search members"
        />
        <select className="mt-select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {statusOptions.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </select>
        <select className="mt-select" value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Channel">
          <option value="">All channels</option>
          {['app', 'web', 'whatsapp', 'ussd'].map((c) => <option key={c} value={c}>{channelLabel[c]}</option>)}
        </select>
        <select className="mt-select" value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Plan">
          <option value="">All plans</option>
          {planOptions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="mt-select" value={flag} onChange={(e) => setFlag(e.target.value)} aria-label="Flags">
          <option value="">All flags</option>
          <option value="conditions">Has conditions</option>
          <option value="high_util">High utilisation</option>
          <option value="pending">Pending verification</option>
        </select>
        <select className="mt-select" value={joined} onChange={(e) => setJoined(e.target.value)} aria-label="Joined">
          <option value="">Any time</option>
          <option value="7">Joined ≤ 7 days</option>
          <option value="30">Joined ≤ 30 days</option>
          <option value="90">Joined ≤ 90 days</option>
          <option value="365">Joined ≤ 1 year</option>
        </select>
        <span className="mt-count">{filtered.length} of {members.length}</span>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-empty">No members match your filters.</p>
      ) : (
        <table className="mt-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Member ID</th>
              <th>Channel</th>
              <th>Status</th>
              <th>Plan</th>
              <th>Last consult</th>
              <th>Joined</th>
              <th>Flags</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const f = flagsFor(m);
              return (
                <tr key={m.id} onClick={() => view(m)}>
                  <td data-label="Name" className="mt-name">{m.full_name}</td>
                  <td data-label="Member ID" className="mt-mono">{m.membership_id || '—'}</td>
                  <td data-label="Channel">
                    <span className={`mt-chip ${channelClass[m.channel] || 'ch-web'}`}>{channelLabel[m.channel] || m.channel}</span>
                  </td>
                  <td data-label="Status">
                    <span className={`mt-status ${statusClass[m.status] || 'st-inactive'}`}>{titleCase(m.status)}</span>
                  </td>
                  <td data-label="Plan" className="mt-muted">{m.plan_name || '—'}</td>
                  <td data-label="Last consult" className="mt-muted">{m.last_consult_at ? formatDate(m.last_consult_at) : '—'}</td>
                  <td data-label="Joined" className="mt-muted">{formatDate(m.created_at)}</td>
                  <td data-label="Flags">
                    <span className="mt-flags">
                      {f.conditions && <span className="mt-flag flag-conditions" title="Has recorded conditions">Conditions</span>}
                      {f.highUtil && <span className="mt-flag flag-util" title={`${m.consultation_count} consultations`}>High use</span>}
                      {f.pending && <span className="mt-flag flag-pending" title="Awaiting verification">Pending</span>}
                      {!f.conditions && !f.highUtil && !f.pending && <span className="mt-muted">—</span>}
                    </span>
                  </td>
                  <td className="mt-actions" onClick={(e) => e.stopPropagation()}>
                    <div className="mt-actions-inner">
                      <button className="mt-act" onClick={() => view(m)}>View</button>
                      {canWrite && <button className="mt-act" onClick={() => edit(m)}>Edit</button>}
                      {canWrite && <button className="mt-act mt-act-danger" onClick={() => onRemove(m)}>Remove</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
