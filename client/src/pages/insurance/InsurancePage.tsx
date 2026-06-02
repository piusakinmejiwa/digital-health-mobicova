import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listPlans, listEnrolments, listMembers, enrolMember, checkoutPremium,
} from '../../api/resources';
import { naira, formatDate, badgeClass } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import './Insurance.css';

const planTypeLabel: Record<string, string> = {
  individual: 'Individual', family: 'Family', hospital_cash: 'Hospital cash',
  group: 'Group', wellness: 'Wellness',
};

export default function InsurancePage() {
  const queryClient = useQueryClient();
  const { canWrite } = useAuth();
  const { data: plans } = useQuery({ queryKey: ['plans'], queryFn: listPlans });
  const { data: enrolments } = useQuery({ queryKey: ['enrolments'], queryFn: listEnrolments });
  const { data: members } = useQuery({ queryKey: ['members'], queryFn: listMembers });

  const [tab, setTab] = useState<'plans' | 'enrolments'>('plans');
  const [enrolPlan, setEnrolPlan] = useState<string | null>(null);
  const [memberId, setMemberId] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['enrolments'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const doEnrol = async () => {
    if (!memberId || !enrolPlan) return;
    setBusy('enrol');
    try {
      await enrolMember({ memberId, planId: enrolPlan });
      setEnrolPlan(null); setMemberId('');
      setTab('enrolments');
      refresh();
    } finally { setBusy(''); }
  };

  const pay = async (enrolmentId: string) => {
    setBusy(enrolmentId);
    try {
      const res = await checkoutPremium(enrolmentId);
      if (res.url) {
        window.location.href = res.url;
      } else {
        setNotice(res.message || 'Premium marked paid (demo mode).');
        refresh();
      }
    } finally { setBusy(''); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Health-linked insurance</h1>
          <p>Plans distributed by MobiCova, underwritten by NAICOM-licensed insurer partners.</p>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'plans' ? 'active' : ''}`} onClick={() => setTab('plans')}>Plan catalog</button>
        <button className={`tab ${tab === 'enrolments' ? 'active' : ''}`} onClick={() => setTab('enrolments')}>
          Enrolments {enrolments ? `(${enrolments.length})` : ''}
        </button>
      </div>

      {notice && <div className="notice">{notice}</div>}

      {tab === 'plans' ? (
        <div className="plans-grid">
          {plans?.map((p) => (
            <div key={p.id} className="plan-card card">
              <div className="plan-head">
                <span className="badge badge-teal">{planTypeLabel[p.plan_type] || p.plan_type}</span>
                <span className="muted small">{p.commission_rate}% commission</span>
              </div>
              <h3 className="plan-name">{p.name}</h3>
              <p className="plan-desc">{p.description}</p>
              <div className="plan-price">{naira(p.monthly_premium, p.currency)}<span>/month</span></div>
              <div className="plan-cover muted small">Cover up to {naira(p.cover_amount, p.currency)}</div>
              <ul className="plan-benefits">
                {p.benefits.map((b) => <li key={b}>{b}</li>)}
              </ul>
              <div className="plan-foot">
                <span className="muted small">Underwritten by {p.underwriter}</span>
                {canWrite && <button className="btn btn-primary btn-sm" onClick={() => { setEnrolPlan(p.id); setNotice(''); }}>Enrol a member</button>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          {!enrolments || enrolments.length === 0 ? (
            <p className="empty-state">No enrolments yet. Enrol a member from the plan catalog.</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Member</th><th>Plan</th><th>Underwriter</th><th>Premium</th><th>Status</th><th>Payment</th><th>Enrolled</th><th></th></tr>
              </thead>
              <tbody>
                {enrolments.map((e) => (
                  <tr key={e.id}>
                    <td><strong>{e.member_name}</strong></td>
                    <td>{e.plan_name}</td>
                    <td className="muted small">{e.underwriter}</td>
                    <td>{naira(e.monthly_premium, e.currency)}/mo</td>
                    <td><span className={`badge ${badgeClass(e.status)}`}>{e.status}</span></td>
                    <td><span className={`badge ${badgeClass(e.payment_status)}`}>{e.payment_status}</span></td>
                    <td className="muted small">{formatDate(e.enrolled_at)}</td>
                    <td>
                      {canWrite && e.payment_status !== 'paid' && (
                        <button className="btn btn-secondary btn-sm" onClick={() => pay(e.id)} disabled={busy === e.id}>
                          {busy === e.id ? '…' : 'Collect premium'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {enrolPlan && (
        <div className="drawer-overlay" onClick={() => setEnrolPlan(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Enrol a member</h3>
            <p className="muted small">{plans?.find((p) => p.id === enrolPlan)?.name}</p>
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>Member</label>
              <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                <option value="">Select member…</option>
                {members?.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEnrolPlan(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={doEnrol} disabled={!memberId || busy === 'enrol'}>
                {busy === 'enrol' ? 'Enrolling…' : 'Confirm enrolment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
