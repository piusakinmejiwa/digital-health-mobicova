import { useQuery } from '@tanstack/react-query';
import { getMemberRewards } from '../../api/member';
import './Member.css';
import './MemberRewards.css';

// Member-facing Rewards screen: points, daily streak, and the badge catalogue
// (earned + still-to-unlock, so there's always a next goal). Points are awarded
// server-side for actions the member already does — consults, triage, daily
// check-ins, on-time prescription collection, completing their profile.
export default function MemberRewardsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['member-rewards'], queryFn: getMemberRewards });

  const earned = data?.badges.filter((b) => b.earned) ?? [];
  const locked = data?.badges.filter((b) => !b.earned) ?? [];

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

          <p className="rw-foot muted small">
            Points and badges are a wellbeing nudge, not medical advice. Your health data is never shared on a leaderboard.
          </p>
        </>
      )}
    </div>
  );
}
