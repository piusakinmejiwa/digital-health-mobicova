import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBillingAccount, changePlan } from '../../api/billing';
import type { BillingTier, BillingUsage } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { naira, formatDate } from '../../lib/format';
import './Billing.css';

const INF = 1_000_000_000;
const fmtLimit = (n: number) => (n >= INF ? 'Unlimited' : n.toLocaleString());
const price = (p: number | null) => (p == null ? 'Custom' : naira(p));

export default function BillingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['billing'], queryFn: getBillingAccount });

  if (user && user.role !== 'admin') return <Navigate to="/dashboard" replace />;

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const pickPlan = async (tier: BillingTier) => {
    if (tier.key === data?.plan.key || tier.price == null) return;
    setBusy(tier.key);
    try {
      await changePlan(tier.key);
      await qc.invalidateQueries({ queryKey: ['billing'] });
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Billing &amp; plan</h1>
          <p>Your MobiCova subscription, usage and invoices.</p>
        </div>
      </div>

      {isLoading || !data ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          {/* Plan banner */}
          <div className="plan-banner">
            <div>
              <div className="pb-tier">{data.plan.name} plan · {price(data.plan.price)}{data.plan.price != null && '/mo'}</div>
              <div className="pb-meta">
                Renews {formatDate(data.renewsAt)} · {data.paymentMethod} · billed monthly in {data.billingCurrency}
              </div>
            </div>
            <div className="pb-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => scrollTo('tiers')}>Change plan</button>
              <button className="btn btn-ghost btn-sm" onClick={() => scrollTo('invoices')}>View invoices</button>
            </div>
          </div>

          {/* Usage + upsell */}
          <div className="bill-grid">
            <div className="card card-pad">
              <h3 className="card-title">Usage this period</h3>
              <div className="usage">
                {data.usage.map((u) => <UsageRow key={u.key} u={u} />)}
              </div>
            </div>

            {data.recommendedTier ? (
              <div className="upsell">
                <span className="u-rec">Recommended</span>
                <h3>{data.recommendedTier.name}</h3>
                <div className="u-price">{price(data.recommendedTier.price)}<span>{data.recommendedTier.price != null && ' /mo'}</span></div>
                <ul>
                  {data.recommendedTier.features.slice(0, 4).map((f) => <li key={f}>{f}</li>)}
                </ul>
                <button
                  className="btn btn-amber btn-block"
                  onClick={() => pickPlan(data.recommendedTier!)}
                  disabled={busy === data.recommendedTier.key}
                >
                  {busy === data.recommendedTier.key ? 'Upgrading…' : `Upgrade to ${data.recommendedTier.name}`}
                </button>
              </div>
            ) : (
              <div className="card card-pad upsell-max">
                <h3 className="card-title">You’re on our top plan</h3>
                <p className="muted">Enterprise gives you unlimited scale and bespoke SLAs. Talk to us about custom needs.</p>
              </div>
            )}
          </div>

          {/* Tiers */}
          <h3 className="section-title" id="tiers">Plans</h3>
          <div className="tiers">
            {data.tiers.map((t) => {
              const current = t.key === data.plan.key;
              return (
                <div key={t.key} className={`tier ${current ? 'current' : ''}`}>
                  <div className="t-name">{t.name}</div>
                  <div className="t-price">{price(t.price)}<span>{t.price != null && ' /mo'}</span></div>
                  <ul>
                    {t.features.map((f) => <li key={f}>{f}</li>)}
                  </ul>
                  {current ? (
                    <button className="btn btn-secondary btn-sm" disabled>Current plan</button>
                  ) : t.price == null ? (
                    <a className="btn btn-ghost btn-sm" href="mailto:sales@mobicova.com">Contact sales</a>
                  ) : (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => pickPlan(t)}
                      disabled={busy === t.key}
                    >
                      {busy === t.key ? '…' : 'Switch'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Invoices */}
          <h3 className="section-title" id="invoices">Invoices</h3>
          <div className="card">
            {data.invoices.length === 0 ? (
              <p className="empty-state small">No invoices yet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Invoice</th><th>Date</th><th>Plan</th><th>Amount</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {data.invoices.map((inv) => (
                    <tr key={inv.reference}>
                      <td><code>{inv.reference}</code></td>
                      <td>{formatDate(inv.date)}</td>
                      <td>{inv.plan}</td>
                      <td>{naira(inv.amount)}</td>
                      <td><span className="badge badge-green">{inv.status}</span></td>
                      <td><span className="muted small" title="Invoice PDFs are generated in production">PDF —</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="muted small bill-note">
            Plan changes here switch your tier immediately for the demo. In production, upgrades route
            through Paystack/Stripe checkout and invoices are generated per billing cycle.
          </p>
        </>
      )}
    </div>
  );
}

function UsageRow({ u }: { u: BillingUsage }) {
  const pct = u.limit >= INF ? Math.min(8, u.used) : Math.min(100, Math.round((u.used / u.limit) * 100));
  const warn = u.limit < INF && pct >= 85;
  return (
    <div className="usage-row">
      <div className="ur-head">
        <b>{u.label}</b>
        <span className="ur-val">{u.used.toLocaleString()} / {fmtLimit(u.limit)}</span>
      </div>
      <div className="ur-track">
        <div className={`ur-fill ${warn ? 'warn' : ''}`} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
      {warn && <div className="ur-note">⚠ Approaching your plan limit — consider upgrading.</div>}
    </div>
  );
}
