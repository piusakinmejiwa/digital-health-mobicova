import { useNavigate } from 'react-router-dom';
import BrandLogo from '../common/BrandLogo';
import SocialLinks from './SocialLinks';
import FloatingAssistant from './FloatingAssistant';
import '../../pages/marketing/Marketing.css';

// Shared marketing footer for standalone public pages (/shape, /buddy) so they
// match the rest of the site. Section links route home; route links navigate.
const FOOT_COLS: { h: string; items: [string, string][] }[] = [
  { h: 'Platform', items: [['Telemedicine', 'services'], ['AI Assistant', 'services'], ['Insurance', 'services'], ['Channels', 'services']] },
  { h: 'Company', items: [['About', 'audiences'], ['Partners', 'audiences'], ['Careers', 'demo'], ['Contact', 'demo']] },
  { h: 'Developers', items: [['API docs', '/login'], ['Webhooks', '/login'], ['Pricing', 'pricing'], ['Security', '/login']] },
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
