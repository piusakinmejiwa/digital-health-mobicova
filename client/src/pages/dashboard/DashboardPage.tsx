import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { getDashboard, dismissOnboarding } from '../../api/resources';
import { useAuth } from '../../context/AuthContext';
import type { Onboarding } from '../../types';
import { naira, formatDateTime, triageLabel, badgeClass } from '../../lib/format';
import './Dashboard.css';

const CHANNEL_COLORS: Record<string, string> = {
  app: '#0a7b7b', whatsapp: '#25D366', ussd: '#f4a23c', web: '#3b82f6',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard });

  if (isLoading || !data) {
    return <div className="page"><p className="muted">Loading dashboard…</p></div>;
  }

  const { onboarding, metrics, milestones, channelBreakdown, triageBreakdown, recentConsultations, recentEnrolments } = data;

  const channelData = channelBreakdown.map((c) => ({ name: c.channel, value: c.count }));
  const pct = (cur: number, target: number) => Math.min(100, (cur / target) * 100);
  const showOnboarding = onboarding && !onboarding.dismissed && !onboarding.allDone;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Welcome back, {user?.orgName}</h1>
          <p>Your MobiCova digital health platform at a glance.</p>
        </div>
        <Link to="/members/new" className="btn btn-primary">+ Add member</Link>
      </div>

      {showOnboarding && <OnboardingPanel onboarding={onboarding} />}

      <div className="metric-grid">
        <MetricCard label="Members" value={metrics.members.toLocaleString()} sub="enrolled" accent="teal" />
        <MetricCard label="Consultations" value={metrics.consultations.toLocaleString()} sub="telemedicine" accent="blue" />
        <MetricCard label="Insurance enrolments" value={metrics.enrolments.toLocaleString()} sub="active plans" accent="amber" />
        <MetricCard label="Triage sessions" value={metrics.triageSessions.toLocaleString()} sub="AI assistant" accent="green" />
        <MetricCard label="Monthly premium" value={naira(metrics.monthlyPremium)} sub="distributed" accent="teal" />
        <MetricCard label="Platform commission" value={naira(metrics.monthlyCommission)} sub="monthly" accent="green" />
      </div>

      <div className="dash-grid">
        <div className="card card-pad">
          <h3 className="card-title">Entry-strategy milestones</h3>
          <p className="muted small">Targets from the digital health strategic briefing.</p>
          <Milestone label={milestones.target10k.label} current={milestones.target10k.current} target={milestones.target10k.target} pct={pct(milestones.target10k.current, milestones.target10k.target)} />
          <Milestone label={milestones.target100k.label} current={milestones.target100k.current} target={milestones.target100k.target} pct={pct(milestones.target100k.current, milestones.target100k.target)} />
        </div>

        <div className="card card-pad">
          <h3 className="card-title">Members by channel</h3>
          {channelData.length === 0 ? (
            <p className="muted small">No members yet.</p>
          ) : (
            <div className="chart-row">
              <ResponsiveContainer width="55%" height={170}>
                <PieChart>
                  <Pie data={channelData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={2}>
                    {channelData.map((c) => (
                      <Cell key={c.name} fill={CHANNEL_COLORS[c.name] || '#94a8ad'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <ul className="legend">
                {channelData.map((c) => (
                  <li key={c.name}>
                    <span className="dot" style={{ background: CHANNEL_COLORS[c.name] || '#94a8ad' }} />
                    {c.name} <strong>{c.value}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-pad card-title-row">
            <h3 className="card-title">Recent consultations</h3>
            <Link to="/telemedicine" className="link-sm">View all</Link>
          </div>
          {recentConsultations.length === 0 ? (
            <p className="empty-state small">No consultations yet.</p>
          ) : (
            <table className="table">
              <tbody>
                {recentConsultations.map((c) => (
                  <tr key={c.id}>
                    <td>{c.member_name}</td>
                    <td className="muted">{c.mode}</td>
                    <td><span className={`badge ${badgeClass(c.status)}`}>{c.status}</span></td>
                    <td className="muted small">{formatDateTime(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card-pad card-title-row">
            <h3 className="card-title">Triage outcomes</h3>
            <Link to="/assistant" className="link-sm">Open assistant</Link>
          </div>
          {triageBreakdown.length === 0 ? (
            <p className="empty-state small">No triage sessions yet.</p>
          ) : (
            <div className="card-pad triage-bars">
              {triageBreakdown.map((t) => (
                <div key={t.triage_level} className="triage-bar-row">
                  <span className={`badge triage-${t.triage_level}`}>{triageLabel(t.triage_level)}</span>
                  <div className="triage-bar-track">
                    <div className="triage-bar-fill" style={{ width: `${Math.min(100, t.count * 18)}%` }} />
                  </div>
                  <strong>{t.count}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-pad card-title-row">
          <h3 className="card-title">Recent insurance enrolments</h3>
          <Link to="/insurance" className="link-sm">View all</Link>
        </div>
        {recentEnrolments.length === 0 ? (
          <p className="empty-state small">No enrolments yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Member</th><th>Plan</th><th>Status</th><th>Payment</th></tr>
            </thead>
            <tbody>
              {recentEnrolments.map((e) => (
                <tr key={e.id}>
                  <td>{e.member_name}</td>
                  <td>{e.plan_name}</td>
                  <td><span className={`badge ${badgeClass(e.status)}`}>{e.status}</span></td>
                  <td><span className={`badge ${badgeClass(e.payment_status)}`}>{e.payment_status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function OnboardingPanel({ onboarding }: { onboarding: Onboarding }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [active, setActive] = useState(onboarding.activeIndex);

  const pct = Math.round((onboarding.completed / onboarding.total) * 100);
  const R = 38;
  const C = 2 * Math.PI * R;
  const step = onboarding.steps[active] || onboarding.steps[onboarding.activeIndex];

  const dismiss = async () => {
    await dismissOnboarding();
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  return (
    <>
      <div className="ob-banner">
        <div className="ob-ring">
          <svg width="88" height="88" viewBox="0 0 88 88">
            <circle cx="44" cy="44" r={R} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="8" />
            <circle
              cx="44" cy="44" r={R} fill="none" stroke="var(--highlight)" strokeWidth="8"
              strokeLinecap="round" strokeDasharray={C.toFixed(2)}
              strokeDashoffset={(C * (1 - pct / 100)).toFixed(2)}
              transform="rotate(-90 44 44)"
            />
          </svg>
          <div className="ob-ring-text">
            <b>{pct}%</b><span>set up</span>
          </div>
        </div>
        <div className="ob-banner-copy">
          <h2>Get MobiCova live</h2>
          <p>{onboarding.completed} of {onboarding.total} steps complete. Finish setup to start enrolling members and collecting premiums across every channel.</p>
        </div>
        <button className="ob-dismiss" onClick={dismiss}>Dismiss setup ✕</button>
      </div>

      <div className="ob-grid">
        <div className="card card-pad">
          <h3 className="card-title">Get to live</h3>
          <p className="muted small">{onboarding.completed} of {onboarding.total} steps complete</p>
          <div className="ob-steps">
            {onboarding.steps.map((s, i) => {
              const state = s.done ? 'done' : i === active ? 'active' : '';
              return (
                <div
                  key={s.key}
                  className={`ob-step ${state}`}
                  onClick={() => { if (!s.done) setActive(i); }}
                >
                  <div className={`ob-check ${state}`}>{s.done ? '✓' : i + 1}</div>
                  <div className="ob-step-body">
                    <div className="ob-step-title">{s.title}</div>
                    <div className="ob-step-sub">{s.sub}</div>
                  </div>
                  {!s.done && i === active && (
                    <button
                      className="btn btn-amber btn-sm"
                      onClick={(e) => { e.stopPropagation(); navigate(s.ctaHref); }}
                    >
                      {s.cta}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="ob-detail">
          <div className="ob-kick">{step.kicker}</div>
          <h3>{step.detailTitle}</h3>
          <p>{step.body}</p>
          <ul className="ob-perks">
            {step.perks.map((p) => <li key={p}>{p}</li>)}
          </ul>
          <button className="btn btn-primary btn-block ob-cta" onClick={() => navigate(step.ctaHref)}>
            {step.cta} →
          </button>
        </div>
      </div>
    </>
  );
}

function MetricCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className={`metric-card accent-${accent}`}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
      <span className="metric-sub">{sub}</span>
    </div>
  );
}

function Milestone({ label, current, target, pct }: { label: string; current: number; target: number; pct: number }) {
  return (
    <div className="milestone">
      <div className="milestone-head">
        <span>{label}</span>
        <span className="muted small">{current.toLocaleString()} / {target.toLocaleString()}</span>
      </div>
      <div className="milestone-track"><div className="milestone-fill" style={{ width: `${Math.max(1.5, pct)}%` }} /></div>
    </div>
  );
}
