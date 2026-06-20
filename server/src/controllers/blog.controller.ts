import { Request, Response } from 'express';
import { query } from '../config/database';
import { env } from '../config/env';
import { uploadImage, storageConfigured } from '../lib/storage';

// Blog: public read (published + due) and platform-admin authoring with scheduling.
// A post is publicly visible when status='published' AND published_at <= now(),
// so a future published_at is a "scheduled" post that appears automatically.

function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 180);
}

function cleanTags(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim().slice(0, 40)).filter(Boolean).slice(0, 12);
}

// ─── Public ──────────────────────────────────────────────────────────────────
export async function listPublishedPosts(_req: Request, res: Response): Promise<void> {
  const r = await query(
    `SELECT slug, title, excerpt, cover_image_url, author, tags, published_at
       FROM blog_posts
      WHERE status = 'published' AND published_at IS NOT NULL AND published_at <= now()
      ORDER BY published_at DESC
      LIMIT 200`
  );
  res.json({ posts: r.rows });
}

export async function getPublishedPost(req: Request, res: Response): Promise<void> {
  const slug = String(req.params.slug || '').slice(0, 200);
  const r = await query(
    `SELECT slug, title, excerpt, body, cover_image_url, author, tags, published_at,
            meta_title, meta_description
       FROM blog_posts
      WHERE slug = $1 AND status = 'published' AND published_at IS NOT NULL AND published_at <= now()
      LIMIT 1`,
    [slug]
  );
  if (r.rows.length === 0) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }
  res.json(r.rows[0]);
}

// XML sitemap of published posts (submit to Google Search Console).
export async function blogSitemap(_req: Request, res: Response): Promise<void> {
  const r = await query(
    `SELECT slug, published_at FROM blog_posts
      WHERE status = 'published' AND published_at IS NOT NULL AND published_at <= now()
      ORDER BY published_at DESC LIMIT 1000`
  );
  const base = (env.clientUrl || '').replace(/\/$/, '') || 'https://mobicova-client.onrender.com';
  const urls = r.rows
    .map((p) => `  <url><loc>${base}/blog/${p.slug}</loc><lastmod>${new Date(p.published_at).toISOString().slice(0, 10)}</lastmod></url>`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${base}/blog</loc></url>\n${urls}\n</urlset>`;
  res.set('Content-Type', 'application/xml').send(xml);
}

// ─── Platform-admin authoring ────────────────────────────────────────────────
export async function adminListPosts(_req: Request, res: Response): Promise<void> {
  const r = await query(
    `SELECT id, slug, title, excerpt, body, cover_image_url, author, tags, status,
            published_at, meta_title, meta_description, created_at, updated_at,
            CASE
              WHEN status <> 'published' THEN 'draft'
              WHEN published_at IS NULL THEN 'draft'
              WHEN published_at > now() THEN 'scheduled'
              ELSE 'live'
            END AS state
       FROM blog_posts
      ORDER BY COALESCE(published_at, updated_at) DESC
      LIMIT 500`
  );
  res.json({ posts: r.rows });
}

function readBody(req: Request) {
  const title = String(req.body?.title || '').trim().slice(0, 200);
  const slug = (String(req.body?.slug || '').trim() ? slugify(String(req.body.slug)) : slugify(title));
  return {
    title,
    slug,
    excerpt: String(req.body?.excerpt || '').slice(0, 600),
    body: String(req.body?.body || '').slice(0, 100000),
    cover_image_url: String(req.body?.coverImageUrl || '').slice(0, 1000),
    author: String(req.body?.author || 'MobiCova Health').slice(0, 120),
    tags: cleanTags(req.body?.tags),
    status: req.body?.status === 'published' ? 'published' : 'draft',
    published_at: req.body?.publishedAt ? new Date(req.body.publishedAt) : null,
    meta_title: String(req.body?.metaTitle || '').slice(0, 200),
    meta_description: String(req.body?.metaDescription || '').slice(0, 320),
  };
}

export async function adminCreatePost(req: Request, res: Response): Promise<void> {
  const d = readBody(req);
  if (!d.title || !d.slug) {
    res.status(400).json({ error: 'A title is required.' });
    return;
  }
  // Default a published post with no date to now (publish immediately).
  if (d.status === 'published' && !d.published_at) d.published_at = new Date();
  try {
    const r = await query(
      `INSERT INTO blog_posts (slug, title, excerpt, body, cover_image_url, author, tags, status, published_at, meta_title, meta_description)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11) RETURNING id, slug`,
      [d.slug, d.title, d.excerpt, d.body, d.cover_image_url, d.author, JSON.stringify(d.tags), d.status, d.published_at, d.meta_title, d.meta_description]
    );
    res.status(201).json(r.rows[0]);
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === '23505') {
      res.status(409).json({ error: 'That slug is already in use — choose another.' });
      return;
    }
    throw err;
  }
}

export async function adminUpdatePost(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  const d = readBody(req);
  if (!d.title || !d.slug) {
    res.status(400).json({ error: 'A title is required.' });
    return;
  }
  if (d.status === 'published' && !d.published_at) d.published_at = new Date();
  try {
    const r = await query(
      `UPDATE blog_posts SET slug=$2, title=$3, excerpt=$4, body=$5, cover_image_url=$6, author=$7,
              tags=$8::jsonb, status=$9, published_at=$10, meta_title=$11, meta_description=$12, updated_at=now()
       WHERE id=$1 RETURNING id, slug`,
      [id, d.slug, d.title, d.excerpt, d.body, d.cover_image_url, d.author, JSON.stringify(d.tags), d.status, d.published_at, d.meta_title, d.meta_description]
    );
    if (r.rows.length === 0) { res.status(404).json({ error: 'Post not found.' }); return; }
    res.json(r.rows[0]);
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === '23505') {
      res.status(409).json({ error: 'That slug is already in use — choose another.' });
      return;
    }
    throw err;
  }
}

export async function adminDeletePost(req: Request, res: Response): Promise<void> {
  await query('DELETE FROM blog_posts WHERE id = $1', [String(req.params.id)]);
  res.json({ deleted: true });
}

// Image upload (cover or in-body) → Supabase Storage → returns a public URL.
export async function adminUploadImage(req: Request & { file?: { buffer: Buffer; mimetype: string } }, res: Response): Promise<void> {
  if (!storageConfigured()) {
    res.status(503).json({ error: 'Image upload is not set up yet. Add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and a public bucket, or paste an image URL instead.' });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: 'No image provided.' });
    return;
  }
  try {
    const url = await uploadImage(req.file.buffer, req.file.mimetype);
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed.' });
  }
}
