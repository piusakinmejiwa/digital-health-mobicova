import { useEffect } from 'react';

// Per-page SEO meta: sets <title>, description and Open Graph tags. Google renders
// client-side JS, so this gives blog posts proper titles/descriptions/share cards.
type Meta = { title?: string; description?: string; image?: string; url?: string; type?: string };

function upsert(attr: 'name' | 'property', key: string, content: string) {
  if (!content) return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function useDocumentMeta({ title, description, image, url, type = 'website' }: Meta) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;
    if (description) upsert('name', 'description', description);
    upsert('property', 'og:title', title || document.title);
    if (description) upsert('property', 'og:description', description);
    if (image) upsert('property', 'og:image', image);
    upsert('property', 'og:type', type);
    upsert('property', 'og:url', url || window.location.href);
    return () => { document.title = prevTitle; };
  }, [title, description, image, url, type]);
}
