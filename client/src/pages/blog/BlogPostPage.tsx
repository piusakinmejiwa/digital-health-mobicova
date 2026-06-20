import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import SiteHeader from '../../components/marketing/SiteHeader';
import SiteFooter from '../../components/marketing/SiteFooter';
import { getBlogPost } from '../../api/blog';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
import './Blog.css';

const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export default function BlogPostPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { data: post, isLoading, isError } = useQuery({
    queryKey: ['blog', slug],
    queryFn: () => getBlogPost(slug),
    retry: false,
  });

  useDocumentMeta({
    title: post ? `${post.meta_title || post.title} — MobiCova Health` : 'MobiCova Blog',
    description: post?.meta_description || post?.excerpt,
    image: post?.cover_image_url,
    type: 'article',
  });

  return (
    <>
      <SiteHeader />
      <div className="mk">
        <div className="blog-wrap blog-post">
          <a className="blog-back" onClick={() => navigate('/blog')} role="button">← All posts</a>

          {isLoading && <p className="muted">Loading…</p>}
          {isError && (
            <div className="empty-state">
              <p>That post isn’t available.</p>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/blog')}>Back to the blog</button>
            </div>
          )}

          {post && (
            <article>
              <h1>{post.title}</h1>
              <div className="blog-meta">
                <span>{post.author}</span><span>·</span><span>{fmt(post.published_at)}</span>
              </div>
              {post.tags?.length > 0 && (
                <div className="blog-tags">{post.tags.map((t) => <span key={t} className="blog-tag">{t}</span>)}</div>
              )}
              {post.cover_image_url && <img className="blog-hero" src={post.cover_image_url} alt={post.title} />}
              <div className="blog-body">
                <ReactMarkdown>{post.body}</ReactMarkdown>
              </div>
            </article>
          )}
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
