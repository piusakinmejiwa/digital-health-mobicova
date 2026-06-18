import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { getInbox } from '../../api/inbox';
import BrandLogo from '../common/BrandLogo';
import './Sidebar.css';

// Demand-side orgs (underwriters, companies, telcos) manage members & cover.
const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '◰' },
  { to: '/inbox', label: 'Inbox', icon: '⊞' },
  { to: '/members', label: 'Members', icon: '⚇' },
  { to: '/telemedicine', label: 'Telemedicine', icon: '✚' },
  { to: '/assistant', label: 'AI Health Assistant', icon: '✦' },
  { to: '/insurance', label: 'Insurance', icon: '◎' },
  { to: '/claims', label: 'Claims', icon: '▦' },
  { to: '/analytics', label: 'Analytics & reporting', icon: '▤' },
  { to: '/channels', label: 'WhatsApp & USSD', icon: '☷' },
  { to: '/partners', label: 'Partner Ecosystem', icon: '⌬' },
];

// Supply-side orgs (clinics, pharmacies) get a focused workspace: their routed
// queue + their own staff. They never see member-management workspaces.
const supplyNavItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '◰' },
  { to: '/staff', label: 'Staff', icon: '⚇' },
];

// Shown only to org admins — subscription, usage & invoices.
const billingNavItem = { to: '/settings/billing', label: 'Billing & plan', icon: '₦' };
// Shown to every signed-in user.
const docsNavItem = { to: '/docs', label: 'Help & docs', icon: '▤' };
// Shown to every signed-in user — self-service two-factor authentication.
const securityNavItem = { to: '/settings/security', label: 'Security', icon: '⛨' };
// Shown only to org admins (role === 'admin') — self-service SSO setup.
const ssoNavItem = { to: '/settings/sso', label: 'Single sign-on', icon: '⚷' };
// Shown only to org admins — public API keys + webhooks.
const developerNavItem = { to: '/settings/developer', label: 'API & webhooks', icon: '⧉' };
// Shown only to org admins — white-label branding.
const brandingNavItem = { to: '/settings/branding', label: 'Branding', icon: '◑' };
// Shown only to org admins — their own organisation's activity/audit trail.
const activityNavItem = { to: '/activity', label: 'Activity log', icon: '◷' };
// Shown only to platform admins (see AuthContext user.isPlatformAdmin).
const adminNavItem = { to: '/admin', label: 'Admin Console', icon: '⚙' };
// Shown only to platform admins — prospect discovery / feature-priority results.
const feedbackAdminNavItem = { to: '/admin/feedback', label: 'Prospect feedback', icon: '✎' };

export default function Sidebar() {
  const { user, logout } = useAuth();
  // Lightweight poll for the unread action-centre count (shared cache with /inbox).
  const { data: inbox } = useQuery({ queryKey: ['inbox'], queryFn: getInbox, refetchInterval: 60000 });
  const unread = inbox?.unread || 0;
  const isSupply = user?.orgClass === 'supply';
  const items = [
    ...(isSupply ? supplyNavItems : navItems),
    docsNavItem,
    securityNavItem,
    ...(user?.role === 'admin' ? [activityNavItem, brandingNavItem, ...(isSupply ? [] : [billingNavItem, ssoNavItem, developerNavItem])] : []),
    ...(user?.isPlatformAdmin ? [adminNavItem, feedbackAdminNavItem] : []),
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <BrandLogo />
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-icon">{item.icon}</span>
            {item.label}
            {item.to === '/inbox' && unread > 0 && <span className="sidebar-badge">{unread}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{user?.fullName?.charAt(0) || 'U'}</div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.orgName}</span>
            <span className="sidebar-user-tier">{user?.partnerType || 'partner'}</span>
          </div>
        </div>
        <button className="sidebar-logout" onClick={logout}>Sign out</button>
      </div>
    </aside>
  );
}
