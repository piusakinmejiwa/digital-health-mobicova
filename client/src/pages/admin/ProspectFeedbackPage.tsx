import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { getProspectFeedback, analyzeProspectFeedback } from '../../api/feedback';
import type { FeedbackInsights } from '../../api/feedback';
import { featureLabel } from '../../lib/featureCatalog';

const SENT_COLOR: Record<string, { fg: string; bg: string }> = {
  positive: { fg: '#1f8a4c', bg: '#e7f5ec' },
  neutral: { fg: '#5e6e6e', bg: '#eef3f3' },
  negative: { fg: '#b4373a', bg: '#fdeeee' },
};

function SentimentBadge({ value }: { value?: string }) {
  if (!value) return <span className="muted">—</span>;
  const c = SENT_COLOR[value] || SENT_COLOR.neutral;
  return (
    <span style={{ color: c.fg, background: c.bg, borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
      {value}
    </span>
  );
}

export default function ProspectFeedbackPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['prospect-feedback'], queryFn: getProspectFeedback });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');

  if (isLoading) return <div className="page"><p>Loading prospect feedback…</p></div>;
  if (error || !data) return <div className="page"><p>Couldn’t load feedback.</p></div>;

  const ranked = Object.keys({ ...data.score, ...data.interest })
    .map((key) => ({ key, score: data.score[key] || 0, interest: data.interest[key] || 0 }))
    .sort((a, b) => b.score - a.score || b.interest - a.interest);
  const maxScore = Math.max(1, ...ranked.map((r) => r.score));
  const when = (s: string) => new Date(s).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

  const insights = data.insights;

  const analyse = async () => {
    setBusy(true); setErr(''); setNote('');
    try {
      const result = await analyzeProspectFeedback();
      setNote(result.analyzed > 0 ? `Analysed ${result.analyzed} new entr${result.analyzed === 1 ? 'y' : 'ies'}.` : 'Nothing new to analyse.');
      qc.invalidateQueries({ queryKey: ['prospect-feedback'] });
    } catch (e) {
      setErr(axios.isAxiosError(e) ? (e.response?.data?.error || 'Could not analyse feedback.') : 'Could not analyse feedback.');
    } finally { setBusy(false); }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Prospect feedback</h1>
          <p className="muted">{data.total} submission{data.total === 1 ? '' : 's'} · what prospects want, by priority.</p>
        </div>
      </header>

      <AiInsightsPanel insights={insights} busy={busy} err={err} note={note} onAnalyse={analyse} />

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
                <th>When</th><th>Name</th><th>Organisation</th><th>Role</th>
                <th>Sentiment</th><th>Themes</th><th>Top priorities</th><th>Pilot</th>
              </tr>
            </thead>
            <tbody>
              {data.submissions.map((s) => (
                <tr key={s.id}>
                  <td>{when(s.created_at)}</td>
                  <td>{s.name || '—'}</td>
                  <td>{s.organisation || '—'}</td>
                  <td>{s.role || '—'}</td>
                  <td><SentimentBadge value={s.ai_sentiment} /></td>
                  <td>
                    {(s.ai_themes && s.ai_themes.length > 0)
                      ? <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
                          {s.ai_themes.map((t) => (
                            <span key={t} style={{ background: '#f3eef8', color: '#6b4794', borderRadius: 5, padding: '1px 7px', fontSize: 12 }}>{t}</span>
                          ))}
                        </span>
                      : <span className="muted">—</span>}
                  </td>
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

function AiInsightsPanel({ insights, busy, err, note, onAnalyse }: {
  insights: FeedbackInsights; busy: boolean; err: string; note: string; onAnalyse: () => void;
}) {
  const { positive, neutral, negative } = insights.sentiment;
  const total = positive + neutral + negative;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  return (
    <section className="card" style={{ marginBottom: 20, background: 'linear-gradient(180deg, rgba(59,130,246,0.05), rgba(59,130,246,0) 60%)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span aria-hidden="true">✨</span>
        <h2 style={{ margin: 0 }}>AI feedback insights</h2>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: '#2f5fb0', background: '#e7eefb', borderRadius: 5, padding: '2px 6px' }}>AI</span>
        <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={onAnalyse} disabled={busy || insights.unanalyzed === 0}>
          {busy ? 'Analysing…' : insights.unanalyzed > 0 ? `Analyse ${insights.unanalyzed} with AI` : 'All analysed'}
        </button>
      </div>

      <p className="muted small" style={{ marginTop: 0 }}>
        AI analysed <strong>{insights.analyzed}</strong> feedback {insights.analyzed === 1 ? 'note' : 'notes'}
        {insights.analyzedThisWeek > 0 && <> · {insights.analyzedThisWeek} this week</>}
        {insights.unanalyzed > 0 && <> · {insights.unanalyzed} awaiting analysis</>}.
      </p>

      {err && <div className="notice notice-error">{err}</div>}
      {note && !err && <div className="notice">{note}</div>}

      {insights.analyzed === 0 ? (
        <p className="muted small" style={{ margin: '6px 0 0' }}>
          No notes analysed yet. Run AI analysis to detect sentiment and the themes prospects raise.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(220px, 1fr) minmax(220px, 1.4fr)', marginTop: 10 }}>
          <div>
            <span className="claim-label" style={{ fontSize: 12, color: '#5e6e6e', fontWeight: 600 }}>Sentiment</span>
            <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', margin: '8px 0' }}>
              <div style={{ width: `${pct(positive)}%`, background: '#16a34a' }} title={`Positive: ${positive}`} />
              <div style={{ width: `${pct(neutral)}%`, background: '#cbd5d5' }} title={`Neutral: ${neutral}`} />
              <div style={{ width: `${pct(negative)}%`, background: '#dc2626' }} title={`Negative: ${negative}`} />
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
              <span style={{ color: '#16a34a' }}>● {positive} positive</span>
              <span style={{ color: '#6b7c7c' }}>● {neutral} neutral</span>
              <span style={{ color: '#dc2626' }}>● {negative} negative</span>
            </div>
          </div>

          <div>
            <span className="claim-label" style={{ fontSize: 12, color: '#5e6e6e', fontWeight: 600 }}>Top themes detected</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {insights.topThemes.length === 0
                ? <span className="muted small">None detected yet.</span>
                : insights.topThemes.map((t) => (
                  <span key={t.theme} style={{ background: '#f3eef8', color: '#6b4794', borderRadius: 6, padding: '3px 9px', fontSize: 13 }}>
                    {t.theme} <strong>{t.count}</strong>
                  </span>
                ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
