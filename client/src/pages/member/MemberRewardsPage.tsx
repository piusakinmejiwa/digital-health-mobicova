import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMemberRewards, getMemberChallenges, getMemberLeaderboard, setMemberLeaderboardOptIn,
} from '../../api/member';
import './Member.css';
import './MemberRewards.css';

// Member-facing Rewards screen: points, daily streak, and the badge catalogue
// (earned + still-to-unlock, so there's always a next goal). Points are awarded
// server-side for actions the member already does — consults, triage, daily
// check-ins, on-time prescription collection, completing their profile.
export default function MemberRewardsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['member-rewards'], queryFn: getMemberRewards });
  const { data: ch } = useQuery({ queryKey: ['member-challenges'], queryFn: getMemberChallenges });

  const earned = data?.badges.filter((b) => b.earned) ?? [];
  const locked = data?.badges.filter((b) => !b.earned) ?? [];
  const challenges = ch?.challenges ?? [];

  return (
    <div className="member-page">
      <section className="member-hero">
        <div>
          <h1>My rewards</h1>
          <p className="muted">Earn points and badges for looking after your health.</p>
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
                    <span><strong>{c.title}</strong>{c.completed && <span className="rw-done"> ✓ done</span>}</span>
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

          <LeaderboardSection />

          <p className="rw-foot muted small">
            Points and badges are a wellbeing nudge, not medical advice. The leaderboard is opt-in and shows points only — never your name or any health information.
          </p>
        </>
      )}
    </div>
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
