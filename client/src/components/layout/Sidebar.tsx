import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '◰' },
  { to: '/members', label: 'Members', icon: '⚇' },
  { to: '/telemedicine', label: 'Telemedicine', icon: '✚' },
  { to: '/assistant', label: 'AI Health Assistant', icon: '✦' },
  { to: '/insurance', label: 'Insurance', icon: '◎' },
  { to: '/analytics', label: 'Analytics & reporting', icon: '▤' },
  { to: '/channels', label: 'WhatsApp & USSD', icon: '☷' },
  { to: '/partners', label: 'Partner Ecosystem', icon: '⌬' },
];

// Shown only to org admins (role === 'admin') — self-service SSO setup.
const ssoNavItem = { to: '/settings/sso', label: 'Single sign-on', icon: '⚷' };
// Shown only to platform admins (see AuthContext user.isPlatformAdmin).
const adminNavItem = { to: '/admin', label: 'Admin Console', icon: '⚙' };

export default function Sidebar() {
  const { user, logout } = useAuth();
  const items = [
    ...navItems,
    ...(user?.role === 'admin' ? [ssoNavItem] : []),
    ...(user?.isPlatformAdmin ? [adminNavItem] : []),
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-mark">M</span>
        <div className="logo-text">
          <span className="logo-name">MobiCova</span>
          <span className="logo-sub">Digital Health</span>
        </div>
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
