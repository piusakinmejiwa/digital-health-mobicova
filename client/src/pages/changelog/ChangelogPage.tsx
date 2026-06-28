import SiteHeader from '../../components/marketing/SiteHeader';
import SiteFooter from '../../components/marketing/SiteFooter';
import ChangelogList from '../../components/ChangelogList';
import HeroIllustration from '../../components/marketing/HeroIllustration';

// Public changelog — for prospects and customers to see the product moving.
export default function ChangelogPage() {
  return (
    <>
      <SiteHeader />
      <div className="mk">
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '48px 20px 72px' }}>
          <div className="page-hero-art"><HeroIllustration kind="sparkle" /></div>
          <h1 style={{ marginBottom: 6 }}>What’s new</h1>
          <p style={{ color: '#5e6e6e', marginTop: 0, marginBottom: 24 }}>
            Product updates and improvements to MobiCova Health. We ship often — here’s the latest.
          </p>
          <ChangelogList />
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
