import { useEffect, useState } from 'react';
import SiteHeader from '../../components/marketing/SiteHeader';
import SiteFooter from '../../components/marketing/SiteFooter';

// Live, self-serve reference for the MobiCova Partner API. Renders the static
// OpenAPI spec (/openapi.json) with Redoc, loaded on demand from a CDN so it
// doesn't weigh down the main bundle. Partners can also download the raw spec
// to import into Postman / Insomnia / their own tooling.
export default function ApiDocsPage() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const REDOC = 'https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js';
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${REDOC}"]`);
    const render = () => {
      const Redoc = (window as unknown as { Redoc?: { init: (s: string, o: object, e: HTMLElement | null) => void } }).Redoc;
      if (!Redoc) { setFailed(true); return; }
      Redoc.init('/openapi.json', {
        hideDownloadButton: false,
        theme: { colors: { primary: { main: '#0a7b7b' } }, typography: { fontFamily: 'inherit' } },
      }, document.getElementById('redoc-container'));
    };
    if (existing) { render(); return; }
    const script = document.createElement('script');
    script.src = REDOC;
    script.onload = render;
    script.onerror = () => setFailed(true);
    document.body.appendChild(script);
  }, []);

  return (
    <>
      <SiteHeader />
      <div className="mk">
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ margin: 0 }}>Partner API</h1>
              <p style={{ color: '#5e6e6e', margin: '4px 0 0' }}>
                Read-only, tenant-scoped REST API for insurers, employers, fintechs and telcos.
              </p>
            </div>
            <a className="btn btn-secondary" href="/openapi.json" download>Download OpenAPI spec</a>
          </div>
          {failed && (
            <div className="notice notice-error" style={{ marginTop: 16 }}>
              Couldn’t load the interactive viewer. You can still <a href="/openapi.json">download the OpenAPI spec</a> and
              import it into Postman, Insomnia or Stoplight.
            </div>
          )}
        </div>
        <div id="redoc-container" style={{ minHeight: '70vh' }} />
      </div>
      <SiteFooter />
    </>
  );
}
