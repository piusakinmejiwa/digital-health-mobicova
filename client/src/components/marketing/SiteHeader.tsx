import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BrandLogo from '../common/BrandLogo';
import LanguageSwitcher from '../common/LanguageSwitcher';
import '../../pages/marketing/Marketing.css';

// Shared marketing-style header for standalone public pages (e.g. /shape) so they
// match the rest of the site. The landing page keeps its own in-page-scrolling
// header; here, section links route home.
export default function SiteHeader() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div className="mk">
      <header className="mk-nav">
        <div className="mk-wrap in">
          <div className="brand" onClick={() => navigate('/')} role="button"><BrandLogo /></div>
          <nav className="links">
            <a onClick={() => navigate('/')}>{t('nav.platform')}</a>
            <a onClick={() => navigate('/')}>{t('nav.whoFor')}</a>
            <a onClick={() => navigate('/')}>{t('nav.pricing')}</a>
            <a onClick={() => navigate('/buddy')}>{t('nav.healthBuddy')}</a>
            <a onClick={() => navigate('/shape')}>{t('nav.shape')}</a>
          </nav>
          <div className="right">
            <LanguageSwitcher />
            <a className="si" onClick={() => navigate('/login')}>{t('nav.signIn')}</a>
            <button className="btn btn-amber" onClick={() => navigate('/')}>{t('nav.bookDemo')}</button>
          </div>
        </div>
      </header>
    </div>
  );
}
