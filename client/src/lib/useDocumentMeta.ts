import { useEffect } from 'react';

// Per-page SEO: sets <title>, description, Open Graph tags, a canonical link, and
// optional JSON-LD structured data. Google renders client-side JS, so this gives
// blog posts proper titles/descriptions/share cards and rich-result eligibility.
type Meta = {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  canonical?: string;
  jsonLd?: Record<string, unknown> | null;
};

const JSONLD_ID = 'mc-jsonld';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  if (!content) return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  if (!href) return;
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function useDocumentMeta({ title, description, image, url, type = 'website', canonical, jsonLd }: Meta) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;
    if (description) upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:title', title || document.title);
    if (description) upsertMeta('property', 'og:description', description);
    if (image) upsertMeta('property', 'og:image', image);
    upsertMeta('property', 'og:type', type);
    const pageUrl = canonical || url || window.location.href;
    upsertMeta('property', 'og:url', pageUrl);
    upsertCanonical(pageUrl);

    if (jsonLd) {
      let script = document.getElementById(JSONLD_ID) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = JSONLD_ID;
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);
    }

    return () => {
      document.title = prevTitle;
      document.getElementById(JSONLD_ID)?.remove();
    };
  }, [title, description, image, url, type, canonical, jsonLd]);
}
