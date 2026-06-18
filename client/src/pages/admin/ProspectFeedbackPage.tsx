import { useQuery } from '@tanstack/react-query';
import { getProspectFeedback } from '../../api/feedback';
import { featureLabel } from '../../lib/featureCatalog';

export default function ProspectFeedbackPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['prospect-feedback'], queryFn: getProspectFeedback });

  if (isLoading) return <div className="page"><p>Loading prospect feedback…</p></div>;
  if (error || !data) return <div className="page"><p>Couldn’t load feedback.</p></div>;

  // Most-wanted by priority-weighted score, then by raw interest.
  const ranked = Object.keys({ ...data.score, ...data.interest })
    .map((key) => ({ key, score: data.score[key] || 0, interest: data.interest[key] || 0 }))
    .sort((a, b) => b.score - a.score || b.interest - a.interest);
  const maxScore = Math.max(1, ...ranked.map((r) => r.score));
  const when = (s: string) => new Date(s).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Prospect feedback</h1>
          <p className="muted">{data.total} submission{data.total === 1 ? '' : 's'} · what prospects want, by priority.</p>
        </div>
      </header>

      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Most-wanted features</h2>
        <p className="muted" style={{ marginTop: -6 }}>Ranked by priority score (top picks weighted highest). Interest = how many prospects ticked it.</p>
        {ranked.length === 0 && <p className="muted">No submissions yet.</p>}
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {ranked.map((r) => (
            <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '230px 1fr 120px', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 600 }}>{featureLabel(r.key)}</span>
              <div style={{ background: '#eef3f3', borderRadius: 6, height: 12, overflow: 'hidden' }}>
                <div style={{ width: `${(r.score / maxScore) * 100}%`, background: '#0a7b7b', height: '100%' }} />
              </div>
              <span className="muted" style={{ fontSize: 13 }}>score {r.score} · {r.interest} interested</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Submissions</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>When</th><th>Name</th><th>Email</th><th>Organisation</th>
                <th>Role</th><th>Country</th><th>Top priorities</th><th>Pilot</th>
              </tr>
            </thead>
            <tbody>
              {data.submissions.map((s) => (
                <tr key={s.id}>
                  <td>{when(s.created_at)}</td>
                  <td>{s.name || '—'}</td>
                  <td>{s.email}</td>
                  <td>{s.organisation || '—'}</td>
                  <td>{s.role || '—'}</td>
                  <td>{s.country || '—'}</td>
                  <td>{(s.priorities || []).map((k) => featureLabel(k)).join(', ') || '—'}</td>
                  <td>{s.pilot_interest ? 'Yes' : '—'}</td>
                </tr>
              ))}
              {data.submissions.length === 0 && (
                <tr><td colSpan={8} className="muted">No submissions yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
