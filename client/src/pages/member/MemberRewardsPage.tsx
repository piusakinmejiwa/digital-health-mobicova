import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  getMemberRewards, getMemberChallenges, getMemberLeaderboard, setMemberLeaderboardOptIn,
  getMemberCatalogue, redeemReward, getMemberRedemptions, getMemberMe,
} from '../../api/member';
import OrgLogo from '../../components/common/OrgLogo';
import './Member.css';
import './MemberRewards.css';

// Member-facing Rewards screen: points, daily streak, and the badge catalogue
// (earned + still-to-unlock, so there's always a next goal). Points are awarded
// server-side for actions the member already does — consults, triage, daily
// check-ins, on-time prescription collection, completing their profile.
export default function MemberRewardsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['member-rewards'], queryFn: getMemberRewards });
  const { data: ch } = useQuery({ queryKey: ['member-challenges'], queryFn: getMemberChallenges });
  const { data: me } = useQuery({ queryKey: ['member-me'], queryFn: getMemberMe });
  const brand = me?.branding;

  const earned = data?.badges.filter((b) => b.earned) ?? [];
  const locked = data?.badges.filter((b) => !b.earned) ?? [];
  const challenges = ch?.challenges ?? [];

  return (
    <div className="member-page">
      <section className="member-hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {brand && <OrgLogo url={brand.logoUrl} letter={brand.logoLetter} name={brand.displayName} color={brand.primaryColor} size={44} />}
          <div>
            <h1>My rewards</h1>
            <p className="muted">{brand?.displayName ? `${brand.displayName} · ` : ''}Earn points and badges for looking after your health.</p>
          </div>
        </div>
      </section>

      {isLoading ? (
        <section className="member-card"><p className="muted">Loading…</p></section>
      ) : (
        <>
          {/* Headline stats */}
          <section className="rw-stats">
            <div className="rw-stat rw-stat-points">
              <span className="rw-stat-num">{data?.totalPoints ?? 0}</span>
              <span className="rw-stat-label">points</span>
            </div>
            <div className="rw-stat">
              <span className="rw-stat-num">🔥 {data?.currentStreak ?? 0}</span>
              <span className="rw-stat-label">day streak</span>
            </div>
            <div className="rw-stat">
              <span className="rw-stat-num">{data?.longestStreak ?? 0}</span>
              <span className="rw-stat-label">best streak</span>
            </div>
          </section>

          {/* Challenges */}
          {challenges.length > 0 && (
            <section className="member-card">
              <h2 className="rw-h2">Challenges</h2>
              {challenges.map((c) => (
                <div key={c.id} className="rw-challenge">
                  <div className="rw-challenge-head">
                    <span><strong>{c.title}</strong>{c.sponsored && <span className="rw-sponsor">★ {brand?.displayName || 'Your organisation'}</span>}{c.completed && <span className="rw-done"> ✓ done</span>}</span>
                    <span className="muted small">+{c.bonusPoints} pts</span>
                  </div>
                  {c.description && <div className="muted small">{c.description}</div>}
                  <div className="rw-prog"><div className="rw-prog-fill" style={{ width: `${Math.round((c.current / c.target) * 100)}%` }} /></div>
                  <div className="muted small">{c.current} / {c.target} · {c.window}</div>
                </div>
              ))}
            </section>
          )}

          {/* Earned badges */}
          <section className="member-card">
            <h2 className="rw-h2">Your badges {earned.length > 0 && <span className="muted small">· {earned.length} earned</span>}</h2>
            {earned.length === 0 ? (
              <p className="muted small">No badges yet — open the app daily and complete your health actions to start earning.</p>
            ) : (
              <div className="rw-grid">
                {earned.map((b) => (
                  <div key={b.slug} className="rw-badge earned" title={b.description}>
                    <span className="rw-badge-emoji">{b.emoji}</span>
                    <span className="rw-badge-label">{b.label}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Still to unlock */}
          {locked.length > 0 && (
            <section className="member-card">
              <h2 className="rw-h2">To unlock</h2>
              <div className="rw-grid">
                {locked.map((b) => (
                  <div key={b.slug} className="rw-badge locked" title={b.description}>
                    <span className="rw-badge-emoji">{b.emoji}</span>
                    <span className="rw-badge-label">{b.label}</span>
                    <span className="rw-badge-desc">{b.description}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <RedeemSection />

          <LeaderboardSection />

          <p className="rw-foot muted small">
            Points and badges are a wellbeing nudge, not medical advice. The leaderboard is opt-in and shows points only — never your name or any health information.
          </p>
        </>
      )}
    </div>
  );
}

// Spend points on rewards (catalogue + redemption history).
function RedeemSection() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['member-catalogue'], queryFn: getMemberCatalogue });
  const { data: hist } = useQuery({ queryKey: ['member-redemptions'], queryFn: getMemberRedemptions });
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const redeem = async (id: string, title: string) => {
    if (!confirm(`Redeem "${title}"? Points will be deducted.`)) return;
    setBusy(id); setMsg('');
    try {
      await redeemReward(id);
      setMsg(`Requested “${title}” — we’ll be in touch to fulfil it.`);
      qc.invalidateQueries({ queryKey: ['member-catalogue'] });
      qc.invalidateQueries({ queryKey: ['member-redemptions'] });
      qc.invalidateQueries({ queryKey: ['member-rewards'] });
    } catch (e: any) {
      setMsg(e?.response?.data?.error || 'Could not redeem.');
    } finally { setBusy(''); }
  };

  if (!data || data.items.length === 0) return null;

  return (
    <section className="member-card">
      <h2 className="rw-h2">Redeem your points <span className="muted small">· {data.balance} available</span></h2>
      {msg && <div className="notice notice-success" style={{ marginBottom: 8 }}>{msg}</div>}
      {data.items.map((it) => {
        const affordable = data.balance >= it.cost_points;
        const out = it.stock !== null && it.stock <= 0;
        return (
          <div key={it.id} className="rw-reward">
            <div>
              <strong>{it.title}</strong> {it.value_label && <span className="muted small">· {it.value_label}</span>}
              {it.sponsored && <span className="rw-sponsor">★ Sponsored</span>}
              {it.description && <div className="muted small">{it.description}</div>}
            </div>
            <button className="btn btn-primary btn-sm" disabled={!affordable || out || busy === it.id}
              onClick={() => redeem(it.id, it.title)}>
              {out ? 'Out of stock' : busy === it.id ? '…' : `${it.cost_points} pts`}
            </button>
          </div>
        );
      })}
      {hist && hist.redemptions.length > 0 && (
        <div className="rw-redemptions">
          <h3 className="rw-h3">Your redemptions</h3>
          {hist.redemptions.map((r) => (
            <div key={r.id} className="rw-redemption-row">
              <span>{r.title}</span>
              <span className={`badge ${r.status === 'fulfilled' ? 'badge-green' : r.status === 'rejected' ? 'badge-gray' : 'badge-amber'}`}>{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Opt-in, anonymised leaderboard within the member's organisation.
function LeaderboardSection() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['member-leaderboard'], queryFn: getMemberLeaderboard });
  const toggle = async (optIn: boolean) => {
    await setMemberLeaderboardOptIn(optIn);
    qc.invalidateQueries({ queryKey: ['member-leaderboard'] });
  };
  if (!data) return null;

  return (
    <section className="member-card">
      <h2 className="rw-h2">Leaderboard</h2>
      {!data.optedIn ? (
        <>
          <p className="muted small">See how you rank against others in your organisation — anonymously. Points only, no names.</p>
          <button className="btn btn-primary btn-sm" onClick={() => toggle(true)}>Join the leaderboard</button>
        </>
      ) : (
        <>
          <p className="muted small">You’re ranked <strong>#{data.rank ?? '—'}</strong> of {data.total}. Others are anonymous.</p>
          <div className="rw-lb">
            {data.top.map((r) => (
              <div key={r.rank} className={`rw-lb-row ${r.isYou ? 'you' : ''}`}>
                <span>#{r.rank} {r.isYou ? 'You' : `Member ${r.rank}`}</span>
                <span>{r.points} pts</span>
              </div>
            ))}
          </div>
          <button className="btn btn-link btn-sm" onClick={() => toggle(false)}>Leave leaderboard</button>
        </>
      )}
    </section>
  );
}
