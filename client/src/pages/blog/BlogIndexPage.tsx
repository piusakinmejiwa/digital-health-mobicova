import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import SiteHeader from '../../components/marketing/SiteHeader';
import SiteFooter from '../../components/marketing/SiteFooter';
import { listBlog } from '../../api/blog';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
import './Blog.css';

const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export default function BlogIndexPage() {
  const navigate = useNavigate();
  const { data: posts, isLoading } = useQuery({ queryKey: ['blog'], queryFn: listBlog });

  useDocumentMeta({
    title: 'Blog — MobiCova Health',
    description: 'News, guides and health information from MobiCova Health — digital health for Nigeria and Africa.',
  });

  return (
    <>
      <SiteHeader />
      <div className="mk">
        <div className="blog-wrap">
          <header className="blog-head">
            <h1>MobiCova Blog</h1>
            <p>Guides, product news and health information — for partners and members.</p>
          </header>

          {isLoading && <p className="muted">Loading…</p>}
          {!isLoading && (!posts || posts.length === 0) && (
            <p className="empty-state">No posts yet — check back soon.</p>
          )}

          <div className="blog-grid">
            {posts?.map((p) => (
              <article key={p.slug} className="blog-card" onClick={() => navigate(`/blog/${p.slug}`)} role="button">
                {p.cover_image_url
                  ? <img className="blog-cover" src={p.cover_image_url} alt={p.title} loading="lazy" />
                  : <div className="blog-cover blog-cover-ph" />}
                <div className="blog-card-body">
                  <h2>{p.title}</h2>
                  <p className="blog-excerpt">{p.excerpt}</p>
                  <div className="blog-meta">
                    <span>{p.author}</span><span>·</span><span>{fmt(p.published_at)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
