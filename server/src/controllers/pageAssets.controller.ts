import { Request, Response } from 'express';
import { query } from '../config/database';
import { generateImage, imagegenConfigured, imagegenProviderLabel } from '../lib/imagegen';
import { uploadImage, storageConfigured } from '../lib/storage';

// Public: map of page slug -> hero image URL (only non-empty ones).
export async function publicPageAssets(_req: Request, res: Response): Promise<void> {
  const r = await query(`SELECT slug, image_url FROM page_assets WHERE image_url <> ''`);
  const assets: Record<string, string> = {};
  for (const row of r.rows) assets[row.slug] = row.image_url;
  res.json({ assets });
}

// Admin: list all saved page assets.
export async function adminListPageAssets(_req: Request, res: Response): Promise<void> {
  const r = await query(`SELECT slug, image_url, prompt, updated_at FROM page_assets ORDER BY slug`);
  res.json({ assets: r.rows, generatorReady: imagegenConfigured(), provider: imagegenProviderLabel() });
}

// Admin: set (or clear) a page's hero image + remember the prompt used.
export async function adminUpsertPageAsset(req: Request, res: Response): Promise<void> {
  const slug = String(req.params.slug || '').slice(0, 80);
  if (!slug) { res.status(400).json({ error: 'Missing page slug.' }); return; }
  const imageUrl = String(req.body?.imageUrl || '').slice(0, 1000);
  const prompt = String(req.body?.prompt || '').slice(0, 2000);
  await query(
    `INSERT INTO page_assets (slug, image_url, prompt, updated_at) VALUES ($1,$2,$3, now())
     ON CONFLICT (slug) DO UPDATE SET image_url = EXCLUDED.image_url, prompt = EXCLUDED.prompt, updated_at = now()`,
    [slug, imageUrl, prompt]
  );
  res.json({ slug, imageUrl });
}

// Admin: generate an image from a prompt → upload to storage → return the URL.
// (Does not save it to a page; the admin previews then chooses to save.)
export async function adminGenerateImage(req: Request, res: Response): Promise<void> {
  if (!imagegenConfigured()) {
    res.status(503).json({ error: 'AI image generation is not set up. Add OPENAI_API_KEY on the API service to enable it.' });
    return;
  }
  if (!storageConfigured()) {
    res.status(503).json({ error: 'Image storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' });
    return;
  }
  const prompt = String(req.body?.prompt || '').trim();
  if (prompt.length < 8) { res.status(400).json({ error: 'Please provide a longer prompt.' }); return; }
  try {
    const { buffer, contentType } = await generateImage(prompt);
    const url = await uploadImage(buffer, contentType);
    res.json({ url });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Image generation failed.' });
  }
}
