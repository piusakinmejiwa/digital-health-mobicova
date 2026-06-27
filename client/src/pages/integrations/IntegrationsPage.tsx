import SiteHeader from '../../components/marketing/SiteHeader';
import SiteFooter from '../../components/marketing/SiteFooter';
import { INTEGRATIONS, AVAILABLE_COUNT, type Integration } from '../../lib/integrations';
import './Integrations.css';

export default function IntegrationsPage() {
  const available = INTEGRATIONS.filter((i) => i.status === 'available');
  const soon = INTEGRATIONS.filter((i) => i.status === 'soon');

  return (
    <>
      <SiteHeader />
      <div className="mk">
        <div className="ig">
          <header className="ig-hero">
            <span className="ig-eyebrow">Integrations</span>
            <h1>Connect MobiCova to the tools you already use</h1>
            <p>
              {AVAILABLE_COUNT} integrations available today — payments, messaging, identity, care and a full
              developer platform — with more on the way.
            </p>
          </header>

          <section>
            <h2>Available now</h2>
            <div className="ig-grid">
              {available.map((i) => <IntegrationTile key={i.name} item={i} />)}
            </div>
          </section>

          <section>
            <h2>Coming soon</h2>
            <div className="ig-grid">
              {soon.map((i) => <IntegrationTile key={i.name} item={i} />)}
            </div>
          </section>

          <section className="ig-cta">
            <h2>Build your own</h2>
            <p>
              Our <a href="/developers/api">REST API</a> and <a href="/webhooks">webhooks</a> let you wire MobiCova
              into anything. Need a connector that isn’t here yet? <a href="/contact">Tell us what you need.</a>
            </p>
          </section>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}

function IntegrationTile({ item }: { item: Integration }) {
  const inner = (
    <>
      <div className="ig-tile-head">
        <span className="ig-logo" aria-hidden>{item.name.charAt(0)}</span>
        <span className={`ig-status ${item.status}`}>{item.status === 'available' ? 'Available' : 'Coming soon'}</span>
      </div>
      <h3>{item.name}</h3>
      <p>{item.blurb}</p>
      <span className="ig-cat">{item.category}</span>
    </>
  );
  return item.href
    ? <a className="ig-tile" href={item.href}>{inner}</a>
    : <div className="ig-tile">{inner}</div>;
}
