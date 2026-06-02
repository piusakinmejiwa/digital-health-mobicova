import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMemberAuth } from '../../context/MemberAuthContext';
import '../../pages/member/Member.css';

// A lightweight, mobile-first chrome for the member portal — a top bar with a
// couple of tabs, no partner sidebar. Deliberately distinct from the staff app.
export default function MemberShell() {
  const { member, logout } = useMemberAuth();
  const navigate = useNavigate();

  const signOut = () => {
    logout();
    navigate('/member/login');
  };

  return (
    <div className="member-app">
      <header className="member-topbar">
        <div className="member-brand">
          <span className="logo-mark">M</span>
          <div className="member-brand-text">
            <strong>MobiCova</strong>
            <span>Member portal</span>
          </div>
        </div>
        <nav className="member-tabs">
          <NavLink end to="/member" className={({ isActive }) => `member-tab ${isActive ? 'active' : ''}`}>
            Overview
          </NavLink>
          <NavLink to="/member/claims" className={({ isActive }) => `member-tab ${isActive ? 'active' : ''}`}>
            Claims
          </NavLink>
        </nav>
        <div className="member-account">
          <span className="member-hello">Hi, {member?.fullName?.split(' ')[0] || 'there'}</span>
          <button className="btn btn-link" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <main className="member-main">
        <Outlet />
      </main>
    </div>
  );
}
