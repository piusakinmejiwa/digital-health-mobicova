import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { getDashboard } from '../../api/resources';
import { useAuth } from '../../context/AuthContext';
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

  const { metrics, milestones, channelBreakdown, triageBreakdown, recentConsultations, recentEnrolments } = data;

  const channelData = channelBreakdown.map((c) => ({ name: c.channel, value: c.count }));
  const pct = (cur: number, target: number) => Math.min(100, (cur / target) * 100);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Welcome back, {user?.orgName}</h1>
          <p>Your MobiCova digital health platform at a glance.</p>
        </div>
        <Link to="/members/new" className="btn btn-primary">+ Add member</Link>
      </div>

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
