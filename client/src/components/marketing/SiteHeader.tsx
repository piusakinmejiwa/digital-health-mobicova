import { useNavigate } from 'react-router-dom';
import BrandLogo from '../common/BrandLogo';
import '../../pages/marketing/Marketing.css';

// Shared marketing-style header for standalone public pages (e.g. /shape) so they
// match the rest of the site. The landing page keeps its own in-page-scrolling
// header; here, section links route home.
export default function SiteHeader() {
  const navigate = useNavigate();
  return (
    <div className="mk">
      <header className="mk-nav">
        <div className="mk-wrap in">
          <div className="brand" onClick={() => navigate('/')} role="button"><BrandLogo /></div>
          <nav className="links">
            <a onClick={() => navigate('/')}>Platform</a>
            <a onClick={() => navigate('/')}>Who it’s for</a>
            <a onClick={() => navigate('/')}>Pricing</a>
            <a onClick={() => navigate('/buddy')}>Health Buddy</a>
            <a onClick={() => navigate('/shape')}>Shape MobiCova</a>
          </nav>
          <div className="right">
            <a className="si" onClick={() => navigate('/login')}>Sign in</a>
            <button className="btn btn-amber" onClick={() => navigate('/')}>Book a demo</button>
          </div>
        </div>
      </header>
    </div>
  );
}
