import { useEffect, useState } from 'react';

// In-product changelog. Code-maintained (add new entries to the top as we ship).
// Powers the public /changelog page and the in-app "What's new" experience.
// "Unseen" tracking is local to the browser (localStorage) — no backend needed.

export type ChangeTag = 'New' | 'Improved' | 'Fixed';

export interface ChangelogEntry {
  date: string;          // YYYY-MM-DD
  title: string;
  tag: ChangeTag;
  items: string[];
}

// Most recent first.
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-06-27', title: 'Notifications Centre', tag: 'New',
    items: [
      'A new bell (top-right) keeps you posted on claims, reports and plan usage.',
      'Choose what shows in-app and what we email you in Settings → Notifications.',
    ],
  },
  {
    date: '2026-06-27', title: 'Trust & Security Centre', tag: 'New',
    items: [
      'A public Trust & Security page sets out our security measures, sub-processors and compliance posture.',
      'Admins can review and accept the Data Processing Agreement and request a data export in Settings → Compliance.',
    ],
  },
  {
    date: '2026-06-27', title: 'Usage & plan limits', tag: 'New',
    items: [
      'Your dashboard now shows plan usage at a glance.',
      'Clear prompts when you approach your member limit, so there are no surprises.',
    ],
  },
  {
    date: '2026-06-26', title: 'Scheduled reports', tag: 'New',
    items: [
      'Branded daily, weekly and monthly reports are emailed to your team automatically.',
      'The monthly executive report covers premium, claims and telemedicine value delivered.',
    ],
  },
  {
    date: '2026-06-20', title: 'Rewards & streaks', tag: 'New',
    items: [
      'Members earn points and badges for healthy habits — daily check-ins, triage and consultations.',
    ],
  },
  {
    date: '2026-06-18', title: 'Doctor network onboarding', tag: 'Improved',
    items: [
      'Bulk-import doctors with their MDCN numbers and upload a network’s compliance documents in one place.',
    ],
  },
  {
    date: '2026-06-15', title: 'Live video consultations', tag: 'New',
    items: [
      'Members and doctors can now meet over secure live video, with an in-app fallback.',
    ],
  },
];

export const LATEST_CHANGE_DATE = CHANGELOG[0]?.date ?? '';
const SEEN_KEY = 'mobicova_changelog_seen';

// Count entries newer than the last time this browser opened "What's new".
export function unseenCount(seen: string | null): number {
  if (!seen) return CHANGELOG.length;
  return CHANGELOG.filter((e) => e.date > seen).length;
}

export function markChangelogSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, LATEST_CHANGE_DATE);
    window.dispatchEvent(new Event('changelog-seen'));
  } catch { /* localStorage unavailable — ignore */ }
}

// Live unseen count for the sidebar badge. Refreshes when "What's new" is opened
// (custom event) or another tab updates storage.
export function useUnseenChangelog(): number {
  const read = () => {
    try { return unseenCount(localStorage.getItem(SEEN_KEY)); } catch { return 0; }
  };
  const [count, setCount] = useState(read);
  useEffect(() => {
    const refresh = () => setCount(read());
    window.addEventListener('changelog-seen', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('changelog-seen', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return count;
}
