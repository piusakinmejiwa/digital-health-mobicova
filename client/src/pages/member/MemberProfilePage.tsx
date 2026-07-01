import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getMemberMe, getMemberOverview, updateMemberLocation, memberLogoutAllDevices } from '../../api/member';
import { useMemberAuth } from '../../context/MemberAuthContext';
import { naira, formatDate, badgeClass } from '../../lib/format';
import './Member.css';

export default function MemberProfilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { logout } = useMemberAuth();
  const { data: me } = useQuery({ queryKey: ['member-me'], queryFn: getMemberMe });
  const { data: overview } = useQuery({ queryKey: ['member-overview'], queryFn: getMemberOverview });
  const cover = overview?.enrolments[0];

  const [addr, setAddr] = useState({ address: '', city: '' });
  const [locState, setLocState] = useState<'idle' | 'saving' | 'saved'>('idle');
  useEffect(() => { if (me) setAddr({ address: me.address || '', city: me.city || '' }); }, [me]);
  const saveLocation = async () => {
    setLocState('saving');
    try { await updateMemberLocation(addr); setLocState('saved'); qc.invalidateQueries({ queryKey: ['member-me'] }); }
    catch { setLocState('idle'); }
  };

  const signOut = () => { logout(); navigate('/member/login'); };

  // Lost/old device: revoke every session server-side, then drop this one too.
  const [allState, setAllState] = useState<'idle' | 'busy'>('idle');
  const signOutEverywhere = async () => {
    if (!confirm('Sign out of MobiCova on all devices? You’ll need to sign in again with a new code.')) return;
    setAllState('busy');
    try { await memberLogoutAllDevices(); } catch { /* revoke best-effort; still drop local session */ }
    logout();
    navigate('/member/login');
  };

  return (
    <div className="m-screen">
      <header className="m-head-plain"><h1>Profile</h1></header>
      <div className="m-body">
        <div className="m-prof-head">
          <div className="m-pa">{me?.full_name?.charAt(0) || 'M'}</div>
          <div>
            <div className="m-prof-name">{me?.full_name}</div>
            <div className="m-prof-sub">Member · {me?.org_name}</div>
          </div>
        </div>

        {me?.membership_id && (
          <div className="m-memid">
            <div className="m-memid-l">Membership ID</div>
            <div className="m-memid-v">{me.membership_id}</div>
            <div className="m-memid-h">Use this to register on USSD or to confirm your membership.</div>
          </div>
        )}

        <div className="m-sec-h">Health snapshot</div>
        <div className="m-statc m-kv-card">
          <div className="m-kv"><span className="k">Blood group</span><span className="v">{me?.blood_group || '—'}</span></div>
          <div className="m-kv"><span className="k">Date of birth</span><span className="v">{me?.date_of_birth ? formatDate(me.date_of_birth) : '—'}</span></div>
          <div className="m-kv">
            <span className="k">Allergies</span>
            <span className="v">{me?.allergies?.length ? <span className="m-tags">{me.allergies.map((a) => <span key={a} className="m-tag">{a}</span>)}</span> : '—'}</span>
          </div>
          <div className="m-kv">
            <span className="k">Conditions</span>
            <span className="v">{me?.chronic_conditions?.length ? <span className="m-tags">{me.chronic_conditions.map((c) => <span key={c} className="m-tag">{c}</span>)}</span> : '—'}</span>
          </div>
        </div>

        <div className="m-sec-h">Cover</div>
        {cover ? (
          <div className="m-list-card">
            <div className="m-ci" style={{ background: '#d6efef', color: '#066' }}>◎</div>
            <div className="m-ct">
              <b>{cover.plan_name}</b>
              <small>{naira(cover.monthly_premium, cover.currency)}/mo · {cover.underwriter}</small>
            </div>
            <span className={`badge ${badgeClass(cover.payment_status)}`}>{cover.payment_status}</span>
          </div>
        ) : (
          <p className="m-muted">No active cover.</p>
        )}

        <div className="m-sec-h">Your location</div>
        <div className="m-statc m-kv-card">
          <p className="m-muted" style={{ margin: '0 0 10px' }}>So prescriptions can be sent to the pharmacy nearest you.</p>
          <input className="m-input" placeholder="Address (street, area)" value={addr.address} onChange={(e) => { setAddr({ ...addr, address: e.target.value }); setLocState('idle'); }} />
          <input className="m-input m-mt-s" placeholder="City / town" value={addr.city} onChange={(e) => { setAddr({ ...addr, city: e.target.value }); setLocState('idle'); }} />
          <button className="m-btn primary m-mt-s" onClick={saveLocation} disabled={locState === 'saving'}>
            {locState === 'saving' ? 'Saving…' : locState === 'saved' ? 'Saved ✓' : 'Save location'}
          </button>
        </div>

        <button className="m-btn ghost m-mt" disabled title="Coming soon">Download member card</button>
        <button className="m-btn ghost m-mt-s m-signout" onClick={signOut}>Sign out</button>
        <button className="m-btn ghost m-mt-s m-signout" onClick={signOutEverywhere} disabled={allState === 'busy'}>
          {allState === 'busy' ? 'Signing out…' : 'Sign out of all devices'}
        </button>
      </div>
    </div>
  );
}
