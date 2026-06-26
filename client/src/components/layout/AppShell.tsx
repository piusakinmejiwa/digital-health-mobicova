import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import HelpLayer from '../help/HelpLayer';
import { useAuth } from '../../context/AuthContext';
import './AppShell.css';

export default function AppShell() {
  const { user, stopImpersonating } = useAuth();
  const navigate = useNavigate();
  const acting = !!user?.acting;

  const exit = () => { stopImpersonating(); navigate('/admin'); };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
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
