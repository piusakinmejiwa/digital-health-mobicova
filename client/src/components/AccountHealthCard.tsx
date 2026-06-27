import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import './AccountHealthCard.css';

interface AccountHealth {
  score: number;
  band: string;
  factors: { key: string; label: string; pct: number }[];
  recommendations: string[];
  contact: { kind: string; label: string; email: string };
  planName: string;
}

function getAccountHealth(): Promise<AccountHealth> {
  return api.get('/dashboard/account-health').then((r) => r.data);
}

const bandClass = (band: string) =>
  band === 'Excellent' ? 'ah-excellent' : band === 'Good' ? 'ah-good' : band === 'Fair' ? 'ah-fair' : 'ah-low';

export default function AccountHealthCard() {
  const { data } = useQuery({ queryKey: ['account-health'], queryFn: getAccountHealth });
  if (!data) return null;

  const r = 34, C = 2 * Math.PI * r;

  return (
    <div className="card card-pad ah-card">
      <div className="ah-main">
        <div className={`ah-ring ${bandClass(data.band)}`}>
          <svg width="84" height="84" viewBox="0 0 84 84">
            <circle cx="42" cy="42" r={r} fill="none" stroke="#eef3f3" strokeWidth="8" />
            <circle cx="42" cy="42" r={r} fill="none" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={C.toFixed(1)} strokeDashoffset={(C * (1 - data.score / 100)).toFixed(1)}
              transform="rotate(-90 42 42)" className="ah-ring-fg" />
          </svg>
          <div className="ah-ring-text"><b>{data.score}</b></div>
        </div>
        <div className="ah-head">
          <h3 className="card-title">Account health</h3>
          <span className={`badge ah-badge ${bandClass(data.band)}`}>{data.band}</span>
          <div className="ah-factors">
            {data.factors.map((f) => (
              <div key={f.key} className="ah-factor" title={`${f.label}: ${f.pct}%`}>
                <span>{f.label}</span>
                <div className="ah-bar"><div className="ah-bar-fill" style={{ width: `${Math.max(3, f.pct)}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {data.recommendations.length > 0 && (
        <ul className="ah-tips">
          {data.recommendations.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      )}

      <div className="ah-contact">
        {data.contact.label}: <a href={`mailto:${data.contact.email}`}>{data.contact.email}</a>
      </div>
    </div>
  );
}
