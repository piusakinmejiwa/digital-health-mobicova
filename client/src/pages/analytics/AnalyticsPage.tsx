import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { getAnalytics, getAnalyticsQuery, getAnalyticsQueryOptions } from '../../api/resources';
import { useAuth } from '../../context/AuthContext';
import { naira, triageLabel } from '../../lib/format';
import { downloadCsv } from '../../lib/download';
import './Analytics.css';

// 'YYYY-MM' → 'Mon YY' for compact axis/table labels.
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, (m || 1) - 1, 1));
  return d.toLocaleString(undefined, { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

const MONTH_OPTIONS = [6, 12, 24];

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [months, setMonths] = useState(6);
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', months],
    queryFn: () => getAnalytics(months),
  });

  if (isLoading || !data) {
    return <div className="page"><p className="muted">Loading analytics…</p></div>;
  }

  const { summary, utilization, trend, premiumByPlan, byUnderwriter,
    consultationsByStatus, consultationsByMode, triageByLevel, channelBreakdown } = data;

  const stamp = new Date().toISOString().slice(0, 10);
  const orgSlug = (user?.orgName || 'report').toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const trendChart = trend.map((t) => ({ ...t, label: monthLabel(t.month) }));

  return (
    <div className="page report">
      <div className="page-header report-header">
        <div>
          <h1>Analytics &amp; reporting</h1>
          <p>{user?.orgName} · generated {stamp} · last {months} months</p>
        </div>
        <div className="report-actions">
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="Reporting window">
            {MONTH_OPTIONS.map((m) => <option key={m} value={m}>Last {m} months</option>)}
          </select>
          <button className="btn btn-secondary" onClick={() => window.print()}>Print / Save as PDF</button>
        </div>
      </div>

      {/* ---- Query builder ---- */}
      <QueryBuilder months={months} />

      {/* ---- Headline KPIs ---- */}
      <div className="metric-grid">
        <Kpi label="Members" value={summary.members.toLocaleString()} sub={`${summary.activeMembers.toLocaleString()} active`} />
        <Kpi label="Consultations" value={summary.consultations.toLocaleString()} sub={`${summary.completedConsultations.toLocaleString()} completed`} />
        <Kpi label="Enrolments" value={summary.enrolments.toLocaleString()} sub={`${summary.paidEnrolments.toLocaleString()} paid`} />
        <Kpi label="Triage sessions" value={summary.triageSessions.toLocaleString()} sub="AI assistant" />
        <Kpi label="Monthly premium" value={naira(summary.monthlyPremium)} sub="active plans" />
        <Kpi label="Platform commission" value={naira(summary.monthlyCommission)} sub="monthly" />
      </div>

      {/* ---- Utilization ---- */}
      <div className="card card-pad">
        <h3 className="card-title">Utilization</h3>
        <p className="muted small">Engagement per member across the platform's services.</p>
        <div className="util-grid">
          <Util label="Consultations / member" value={utilization.consultationsPerMember} />
          <Util label="Triage / member" value={utilization.triagePerMember} />
          <Util label="Enrolments / member" value={utilization.enrolmentRate} />
          <Util label="Active member rate" value={`${Math.round(utilization.activeRate * 100)}%`} />
        </div>
      </div>

      {/* ---- Growth trend ---- */}
      <div className="card card-pad">
        <div className="card-title-row" style={{ padding: 0 }}>
          <h3 className="card-title">Growth trend</h3>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => downloadCsv(`${orgSlug}-trend-${stamp}.csv`, trend, [
              { key: 'month', label: 'Month' },
              { key: 'members', label: 'New members' },
              { key: 'consultations', label: 'Consultations' },
              { key: 'enrolments', label: 'Enrolments' },
            ])}
          >Export CSV</button>
        </div>
        {trend.every((t) => t.members + t.consultations + t.enrolments === 0) ? (
          <p className="empty-state small">No activity recorded in this window yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trendChart} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1f1" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="members" name="New members" fill="#0a7b7b" radius={[3, 3, 0, 0]} />
              <Bar dataKey="consultations" name="Consultations" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="enrolments" name="Enrolments" fill="#f4a23c" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ---- Premium & commission by plan ---- */}
      <div className="card">
        <div className="card-pad card-title-row">
          <h3 className="card-title">Premium &amp; commission by plan</h3>
          <button
            className="btn btn-secondary btn-sm"
            disabled={premiumByPlan.length === 0}
            onClick={() => downloadCsv(`${orgSlug}-premium-by-plan-${stamp}.csv`, premiumByPlan, [
              { key: 'planName', label: 'Plan' },
              { key: 'underwriter', label: 'Underwriter' },
              { key: 'enrolments', label: 'Enrolments' },
              { key: 'premium', label: 'Monthly premium (NGN)' },
              { key: 'commission', label: 'Monthly commission (NGN)' },
            ])}
          >Export CSV</button>
        </div>
        {premiumByPlan.length === 0 ? (
          <p className="empty-state small">No active enrolments yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Plan</th><th>Underwriter</th><th>Enrolments</th><th>Premium</th><th>Commission</th></tr>
            </thead>
            <tbody>
              {premiumByPlan.map((p) => (
                <tr key={p.planName}>
                  <td><strong>{p.planName}</strong></td>
                  <td className="muted small">{p.underwriter}</td>
                  <td>{p.enrolments}</td>
                  <td>{naira(p.premium)}</td>
                  <td>{naira(p.commission)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} className="muted small">Total</td>
                <td><strong>{premiumByPlan.reduce((s, p) => s + p.enrolments, 0)}</strong></td>
                <td><strong>{naira(premiumByPlan.reduce((s, p) => s + p.premium, 0))}</strong></td>
                <td><strong>{naira(premiumByPlan.reduce((s, p) => s + p.commission, 0))}</strong></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <div className="dash-grid">
        {/* ---- By underwriter ---- */}
        <div className="card">
          <div className="card-pad card-title-row">
            <h3 className="card-title">By underwriter</h3>
            <button
              className="btn btn-secondary btn-sm"
              disabled={byUnderwriter.length === 0}
              onClick={() => downloadCsv(`${orgSlug}-by-underwriter-${stamp}.csv`, byUnderwriter, [
                { key: 'underwriter', label: 'Underwriter' },
                { key: 'enrolments', label: 'Enrolments' },
                { key: 'premium', label: 'Monthly premium (NGN)' },
              ])}
            >Export CSV</button>
          </div>
          {byUnderwriter.length === 0 ? (
            <p className="empty-state small">No active enrolments yet.</p>
          ) : (
            <table className="table">
              <thead><tr><th>Underwriter</th><th>Enrolments</th><th>Premium</th></tr></thead>
              <tbody>
                {byUnderwriter.map((u) => (
                  <tr key={u.underwriter}>
                    <td>{u.underwriter}</td>
                    <td>{u.enrolments}</td>
                    <td>{naira(u.premium)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ---- Service mix ---- */}
        <div className="card card-pad">
          <h3 className="card-title">Service mix</h3>
          <Distribution title="Consultations by status" rows={consultationsByStatus.map((r) => ({ label: r.status, count: r.count }))} />
          <Distribution title="Consultations by mode" rows={consultationsByMode.map((r) => ({ label: r.mode, count: r.count }))} />
          <Distribution title="Triage outcomes" rows={triageByLevel.map((r) => ({ label: triageLabel(r.triage_level), count: r.count }))} />
          <Distribution title="Members by channel" rows={channelBreakdown.map((r) => ({ label: r.channel, count: r.count }))} />
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="metric-card accent-teal">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
      <span className="metric-sub">{sub}</span>
    </div>
  );
}

// ---- Ad-hoc query builder (measure × dimension) ----
const qbMoney = (n: number) => `₦${(n / 1e6).toFixed(2)}M`;

function QueryBuilder({ months }: { months: number }) {
  const { data: opts } = useQuery({ queryKey: ['analytics-q-options'], queryFn: getAnalyticsQueryOptions });
  const [measure, setMeasure] = useState('Members');
  const [dimension, setDimension] = useState('Channel');
  const [view, setView] = useState<'chart' | 'table'>('chart');

  const measures = opts?.measures || [];
  const dims = measures.find((m) => m.key === measure)?.dimensions || ['Channel'];
  const effectiveDim = dims.includes(dimension) ? dimension : dims[0];

  const { data, isFetching } = useQuery({
    queryKey: ['analytics-q', measure, effectiveDim, months],
    queryFn: () => getAnalyticsQuery(measure, effectiveDim, months),
  });

  const fmt = (n: number) => (data?.money ? qbMoney(n) : Math.round(n).toLocaleString());
  const max = data ? Math.max(...data.rows.map((r) => r.value), 0) : 0;

  const exportCsv = () => {
    if (!data) return;
    downloadCsv(
      `${measure}-by-${effectiveDim}.csv`,
      data.rows as unknown as Record<string, unknown>[],
      [{ key: 'label', label: effectiveDim }, { key: 'value', label: measure }]
    );
  };

  return (
    <div className="qb">
      <div className="qb-config">
        <div className="qc-lbl">Measure</div>
        <select className="qb-select" value={measure} onChange={(e) => setMeasure(e.target.value)}>
          {measures.map((m) => <option key={m.key} value={m.key}>{m.key === 'Premium' ? 'Premium (₦)' : m.key}</option>)}
        </select>

        <div className="qc-lbl">Group by</div>
        <div className="chip-row">
          {dims.map((d) => (
            <span key={d} className={`qchip ${d === effectiveDim ? 'on' : ''}`} onClick={() => setDimension(d)}>{d}</span>
          ))}
        </div>

        <div className="qc-lbl">Window</div>
        <div className="muted small">Last {months} months (set above)</div>

        <button className="btn btn-secondary btn-sm qb-export" onClick={exportCsv} disabled={!data}>Export CSV</button>
      </div>

      <div className="qb-result">
        <div className="qb-result-head">
          <h3>{measure === 'Premium' ? 'Premium (₦)' : measure} by {effectiveDim}</h3>
          <span className="meta">
            {data ? `${data.rows.length} groups · ${fmt(data.total)} total` : isFetching ? 'Running…' : ''}
          </span>
        </div>

        <div className="qb-toggle">
          <button className={view === 'chart' ? 'on' : ''} onClick={() => setView('chart')}>Chart</button>
          <button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>Table</button>
        </div>

        {!data || data.rows.length === 0 ? (
          <p className="muted small">No data for this combination in the selected window.</p>
        ) : view === 'chart' ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.rows} margin={{ top: 16, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef3f3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={data.rows.length > 6 ? -20 : 0} textAnchor={data.rows.length > 6 ? 'end' : 'middle'} height={data.rows.length > 6 ? 50 : 24} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (data.money ? `₦${(v / 1e6).toFixed(1)}M` : v)} />
              <Tooltip formatter={(v: unknown) => fmt(Number(v))} />
              <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                {data.rows.map((r) => (
                  <Cell key={r.label} fill={r.value === max ? '#f4a23c' : '#0a7b7b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <table className="table qb-table">
            <thead><tr><th>{effectiveDim}</th><th>{measure}</th><th>% of total</th></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td>{fmt(r.value)}</td>
                  <td className="muted">{data.total ? ((r.value / data.total) * 100).toFixed(1) : '0'}%</td>
                </tr>
              ))}
              <tr className="qb-total"><td>Total</td><td>{fmt(data.total)}</td><td>100%</td></tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Util({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="util-card">
      <span className="util-value">{value}</span>
      <span className="util-label">{label}</span>
    </div>
  );
}

function Distribution({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="dist">
      <span className="dist-title">{title}</span>
      {rows.length === 0 ? (
        <span className="muted small">No data yet.</span>
      ) : (
        rows.map((r) => (
          <div key={r.label} className="dist-row">
            <span className="dist-label">{r.label}</span>
            <div className="dist-track"><div className="dist-fill" style={{ width: `${(r.count / max) * 100}%` }} /></div>
            <strong className="dist-count">{r.count}</strong>
          </div>
        ))
      )}
    </div>
  );
}
