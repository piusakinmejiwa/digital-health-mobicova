import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import HelpLayer from '../help/HelpLayer';
import NotificationBell from './NotificationBell';
import { useAuth } from '../../context/AuthContext';
import './AppShell.css';

const COLLAPSE_KEY = 'mobicova_sidebar_collapsed';

export default function AppShell() {
  const { user, stopImpersonating } = useAuth();
  const navigate = useNavigate();
  const acting = !!user?.acting;
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const exit = () => { stopImpersonating(); navigate('/admin'); };

  return (
    <div className="app-shell">
      <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      <NotificationBell />
      <main className={`app-main ${collapsed ? 'sidebar-collapsed' : ''}`}>
        {acting && (
          <div className="impersonation-banner">
            <span>👁 Viewing as <strong>{user?.orgName}</strong> — changes you make apply to this organisation.</span>
            <button onClick={exit}>Exit to Admin Console</button>
          </div>
        )}
        <Outlet />
      </main>
      <HelpLayer />
    </div>
  );
}
