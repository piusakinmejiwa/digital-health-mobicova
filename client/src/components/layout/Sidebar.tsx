import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { getInbox } from '../../api/inbox';
import { useUnseenChangelog } from '../../lib/changelog';
import BrandLogo from '../common/BrandLogo';
import './Sidebar.css';

type NavItem = { to: string; label: string; icon: string };

// Demand-side orgs (underwriters, companies, telcos) manage members & cover.
const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '◰' },
  { to: '/inbox', label: 'Inbox', icon: '⊞' },
  { to: '/members', label: 'Members', icon: '⚇' },
  { to: '/telehealth', label: 'Telemedicine', icon: '✚' },
  { to: '/assistant', label: 'AI Health Assistant', icon: '✦' },
  { to: '/cover', label: 'Insurance', icon: '◎' },
  { to: '/claims', label: 'Claims', icon: '▦' },
  { to: '/analytics', label: 'Analytics & reporting', icon: '▤' },
  { to: '/messaging', label: 'WhatsApp & USSD', icon: '☷' },
  { to: '/ecosystem', label: 'Partner Ecosystem', icon: '⌬' },
];

// Supply-side orgs (clinics, pharmacies) get a focused workspace: their routed
// queue + their own staff. They never see member-management workspaces.
const supplyNavItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '◰' },
  { to: '/staff', label: 'Staff', icon: '⚇' },
];

// Shown only to HMO/insurer orgs — the onboarding console for their employers.
const employersNavItem = { to: '/employers', label: 'Employers', icon: '⚑' };
// Shown only to org admins — subscription, usage & invoices.
const billingNavItem = { to: '/settings/billing', label: 'Billing & plan', icon: '₦' };
// Shown to every signed-in user.
const docsNavItem = { to: '/docs', label: 'Help & docs', icon: '▤' };
// Shown to every signed-in user — self-service two-factor authentication.
const securityNavItem = { to: '/settings/security', label: 'Security', icon: '⛨' };
// Shown to every signed-in user — personal notification preferences.
const notificationsNavItem = { to: '/settings/notifications', label: 'Notifications', icon: '◉' };
// Shown to every signed-in user — in-product changelog (badge = unseen count).
const whatsNewNavItem = { to: '/whats-new', label: "What's new", icon: '✦' };
// Shown only to org admins — DPA, sub-processors & data rights (Trust Centre).
const complianceNavItem = { to: '/settings/compliance', label: 'Compliance', icon: '⛉' };
// Shown only to org admins (role === 'admin') — self-service SSO setup.
const ssoNavItem = { to: '/settings/sso', label: 'Single sign-on', icon: '⚷' };
// Shown only to org admins — public API keys + webhooks.
const developerNavItem = { to: '/settings/developer', label: 'API & webhooks', icon: '⧉' };
// Shown only to org admins — white-label branding.
const brandingNavItem = { to: '/settings/branding', label: 'Branding', icon: '◑' };
// Shown only to demand-org admins — their own rewards programme (challenges/catalogue).
const rewardsNavItem = { to: '/rewards', label: 'Rewards', icon: '★' };
// Shown only to org admins — their own organisation's activity/audit trail.
const activityNavItem = { to: '/activity', label: 'Activity log', icon: '◷' };
// Shown only to platform admins (see AuthContext user.isPlatformAdmin).
const adminNavItem = { to: '/admin', label: 'Admin Console', icon: '⚙' };
// Shown only to platform admins — prospect discovery / feature-priority results.
const feedbackAdminNavItem = { to: '/admin/feedback', label: 'Prospect feedback', icon: '✎' };

function SidebarLink({ item, unread, whatsNew = 0, collapsed = false }: { item: NavItem; unread: number; whatsNew?: number; collapsed?: boolean }) {
  const badge = item.to === '/inbox' ? unread : item.to === '/whats-new' ? whatsNew : 0;
  return (
    <NavLink
      to={item.to}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'is-collapsed' : ''}`}
    >
      <span className="sidebar-icon">{item.icon}</span>
      {!collapsed && item.label}
      {!collapsed && badge > 0 && <span className="sidebar-badge">{badge}</span>}
      {collapsed && badge > 0 && <span className="sidebar-badge-dot" />}
    </NavLink>
  );
}

// A collapsible group of secondary nav items. Collapsed by default; opens
// automatically when you're on one of its pages so the active item is visible.
function SidebarGroup({ label, items, unread }: { label: string; items: NavItem[]; unread: number }) {
  const { pathname } = useLocation();
  const hasActive = items.some((i) => pathname === i.to || pathname.startsWith(i.to + '/'));
  const [open, setOpen] = useState(hasActive);
  useEffect(() => { if (hasActive) setOpen(true); }, [hasActive]);

  return (
    <div className="sidebar-group">
      <button className="sidebar-group-head" onClick={() => setOpen((o) => !o)}>
        <span>{label}</span>
        <span className={`sidebar-group-caret ${open ? 'open' : ''}`}>▾</span>
      </button>
      {open && items.map((item) => <SidebarLink key={item.to} item={item} unread={unread} />)}
    </div>
  );
}

export default function Sidebar({ collapsed = false, onToggle }: { collapsed?: boolean; onToggle?: () => void }) {
  const { user, logout } = useAuth();
  // Lightweight poll for the unread action-centre count (shared cache with /inbox).
  const { data: inbox } = useQuery({ queryKey: ['inbox'], queryFn: getInbox, refetchInterval: 60000 });
  const unread = inbox?.unread || 0;
  const whatsNew = useUnseenChangelog();
  const isSupply = user?.orgClass === 'supply';
  const isAdmin = user?.role === 'admin';
  // HMO / insurer orgs get the Employers onboarding console in their workspace.
  const isParentTier = user?.partnerType === 'hmo' || user?.partnerType === 'underwriter';
  const demandNav = isParentTier
    ? [...navItems.slice(0, 3), employersNavItem, ...navItems.slice(3)]
    : navItems;
  // Platform admins are MobiCova staff — they operate across all orgs from the
  // Admin Console and have no tenant workspace of their own. EXCEPT while
  // "viewing as" a tenant, where they get that org's normal workspace.
  const isPlatform = !!user?.isPlatformAdmin && !user?.acting;

  // Daily workspace — for a platform admin, the Console *is* their workspace.
  const workspace = isPlatform
    ? [adminNavItem, feedbackAdminNavItem]
    : (isSupply ? supplyNavItems : demandNav);
  // Occasional items — tucked into collapsible groups to keep the bar short.
  const settingsItems: NavItem[] = isPlatform
    ? [docsNavItem, securityNavItem, notificationsNavItem]
    : [
        docsNavItem,
        securityNavItem,
        notificationsNavItem,
        ...(isAdmin ? [brandingNavItem, complianceNavItem, ...(isSupply ? [] : [billingNavItem, ssoNavItem, developerNavItem, rewardsNavItem])] : []),
      ];
  const adminItems: NavItem[] = isPlatform ? [] : (isAdmin ? [activityNavItem] : []);

  // Collapsed mode flattens the groups into a single icon rail so everything
  // stays one click away.
  const flatItems: NavItem[] = [...workspace, whatsNewNavItem, ...settingsItems, ...adminItems];

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar-logo">
        {!collapsed && <BrandLogo />}
        <button
          className="sidebar-collapse"
          onClick={onToggle}
          title={collapsed ? 'Expand menu' : 'Collapse menu'}
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>

      <nav className="sidebar-nav">
        {collapsed ? (
          flatItems.map((item) => <SidebarLink key={item.to} item={item} unread={unread} whatsNew={whatsNew} collapsed />)
        ) : (
          <>
            {workspace.map((item) => <SidebarLink key={item.to} item={item} unread={unread} />)}
            <SidebarLink item={whatsNewNavItem} unread={0} whatsNew={whatsNew} />
            {settingsItems.length > 0 && <SidebarGroup label="Settings" items={settingsItems} unread={unread} />}
            {adminItems.length > 0 && <SidebarGroup label="Admin" items={adminItems} unread={unread} />}
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{user?.fullName?.charAt(0) || 'U'}</div>
          {!collapsed && (
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.orgName}</span>
              <span className="sidebar-user-tier">{user?.partnerType || 'partner'}</span>
            </div>
          )}
        </div>
        <button className="sidebar-logout" onClick={logout} title="Sign out">
          {collapsed ? '⎋' : 'Sign out'}
        </button>
      </div>
    </aside>
  );
}
