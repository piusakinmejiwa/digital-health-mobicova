import { useNavigate } from 'react-router-dom';
import BrandLogo from '../common/BrandLogo';
import SocialLinks from './SocialLinks';
import FloatingAssistant from './FloatingAssistant';
import '../../pages/marketing/Marketing.css';

// Shared marketing footer for standalone public pages (/shape, /buddy) so they
// match the rest of the site. Section links route home; route links navigate.
const FOOT_COLS: { h: string; items: [string, string][] }[] = [
  { h: 'Platform', items: [['Telemedicine', '/telemedicine'], ['AI Assistant', '/ask'], ['Daily Health Tips', '/health-tips'], ['Insurance', '/insurance'], ['Channels', '/channels']] },
  { h: 'Company', items: [['About', '/about'], ['Partners', '/partners'], ['Trust & security', '/trust'], ['Careers', '/careers'], ['Contact', '/contact'], ['Shape MobiCova', '/shape']] },
  { h: 'Developers', items: [['API reference', '/developers/api'], ['Webhooks', '/webhooks'], ['Pricing', '/pricing'], ['Security', '/security']] },
];

export default function SiteFooter() {
  const navigate = useNavigate();
  const go = (t: string) => (t.startsWith('/') ? navigate(t) : navigate('/'));
  return (
    <div className="mk">
      <footer className="mk-foot">
        <div className="mk-wrap">
          <div className="cols">
            <div>
              <div className="brand" onClick={() => navigate('/')} role="button"><BrandLogo /></div>
              <p className="foot-blurb">Digital health infrastructure connecting Africans to care, on any phone.</p>
              <SocialLinks />
            </div>
            {FOOT_COLS.map((col) => (
              <div key={col.h}>
                <h5>{col.h}</h5>
                {col.items.map(([label, t]) => (<a key={label} onClick={() => go(t)}>{label}</a>))}
              </div>
            ))}
          </div>
          <div className="bottom">
            <span>© 2026 MobiCova Health. All rights reserved.</span>
            <span className="foot-legal">
              <a onClick={() => navigate('/privacy')}>Privacy</a>
              <a onClick={() => navigate('/cookies')}>Cookies</a>
              <a onClick={() => navigate('/ai')}>AI Policy</a>
            </span>
          </div>
        </div>
      </footer>
      <FloatingAssistant />
    </div>
  );
}
