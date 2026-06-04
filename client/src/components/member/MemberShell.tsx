import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { CSSProperties } from 'react';
import { getMemberMe } from '../../api/member';
import '../../pages/member/Member.css';
import '../../pages/member/MemberApp.css';

// Mobile-first member app: a centered phone-width column with a bottom tab bar.
// Each screen renders its own header (the branded teal header lives on Home).
// Brand colours come from the org's white-label settings (Phase 2 branding).
const TABS = [
  { to: '/member', label: 'Home', icon: '⌂', end: true },
  { to: '/member/care', label: 'Care', icon: '✚', end: false },
  { to: '/member/claims', label: 'Claims', icon: '▦', end: false },
  { to: '/member/profile', label: 'Profile', icon: '◎', end: false },
];

export default function MemberShell() {
  const { data: me } = useQuery({ queryKey: ['member-me'], queryFn: getMemberMe });
  const brand = me?.branding;
  const style = brand
    ? ({ '--brand': brand.primaryColor, '--brand-2': brand.accentColor } as CSSProperties)
    : undefined;

  return (
    <div className="mapp" style={style}>
      <div className="mapp-content">
        <Outlet />
      </div>
      <nav className="m-tabbar">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => `m-tab ${isActive ? 'on' : ''}`}
          >
            <span className="m-ti">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
