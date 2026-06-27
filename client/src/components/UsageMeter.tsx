import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getUsage, type UsageItem } from '../api/billing';
import './UsageMeter.css';

// Plan usage widget — live meters vs the org's tier limits, with an
// "approaching limit" warning on hard caps. Used on the dashboard.
export default function UsageMeter() {
  const { data } = useQuery({ queryKey: ['usage'], queryFn: getUsage });
  if (!data) return null;

  // The most pressing hard cap that's near/over (members), if any.
  const alert = data.usage
    .filter((u) => u.hard && !u.unlimited && u.pct >= 80)
    .sort((a, b) => b.pct - a.pct)[0];

  return (
    <div className="card card-pad usage-card">
      <div className="card-title-row">
        <h3 className="card-title">Plan usage</h3>
        <Link to="/settings/billing" className="link-sm">{data.plan.name} plan →</Link>
      </div>

      {alert && (
        <div className={`usage-alert ${alert.pct >= 100 ? 'over' : 'near'}`}>
          {alert.pct >= 100
            ? <>You’ve reached your <strong>{alert.label.toLowerCase()}</strong> limit ({alert.used.toLocaleString()}/{alert.limit.toLocaleString()}). </>
            : <>You’re at <strong>{alert.pct}%</strong> of your {alert.label.toLowerCase()} limit. </>}
          <Link to="/settings/billing">Upgrade plan →</Link>
        </div>
      )}

      <div className="usage-bars">
        {data.usage.map((u) => <UsageBar key={u.key} item={u} />)}
      </div>
    </div>
  );
}

function UsageBar({ item }: { item: UsageItem }) {
  const pct = Math.min(100, item.pct);
  const tone = item.unlimited ? 'ok' : item.pct >= 100 ? 'over' : item.pct >= 80 ? 'near' : 'ok';
  return (
    <div className="usage-row">
      <div className="usage-row-head">
        <span>{item.label}{item.hard && <span className="usage-cap" title="Hard limit — blocks at the cap"> · cap</span>}</span>
        <span className="muted small">
          {item.used.toLocaleString()}{item.unlimited ? '' : ` / ${item.limit.toLocaleString()}`}
          {item.unlimited && <span className="usage-unlimited"> · unlimited</span>}
        </span>
      </div>
      <div className="usage-track">
        <div className={`usage-fill ${tone}`} style={{ width: `${item.unlimited ? 4 : Math.max(2, pct)}%` }} />
      </div>
    </div>
  );
}
