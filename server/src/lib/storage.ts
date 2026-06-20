import { randomUUID } from 'crypto';
import { env } from '../config/env';

// Upload an image to Supabase Storage (a public bucket) and return its public URL.
// Uses the Storage REST API directly (no extra SDK). Requires SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY and a public bucket (default "blog").

export const storageConfigured = (): boolean => !!(env.supabaseUrl && env.supabaseServiceRoleKey);

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
  'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif',
};

export async function uploadImage(buffer: Buffer, contentType: string): Promise<string> {
  if (!storageConfigured()) {
    throw new Error('Image upload is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, and create a public bucket.');
  }
  const ext = EXT[contentType.toLowerCase()];
  if (!ext) throw new Error('Unsupported image type. Use JPG, PNG, WebP, GIF or AVIF.');

  const path = `${randomUUID()}.${ext}`;
  const bucket = env.supabaseBlogBucket;
  // Use only the project origin (strip any path like /rest/v1 so we hit Storage,
  // not PostgREST — which returns PGRST125 "Invalid path").
  let base: string;
  try { base = new URL(env.supabaseUrl).origin; } catch { base = (env.supabaseUrl || '').replace(/\/+$/, ''); }
  const res = await fetch(`${base}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      // Supabase's gateway requires the apikey header in addition to Authorization.
      apikey: env.supabaseServiceRoleKey,
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
      'cache-control': '31536000',
    },
    body: new Uint8Array(buffer),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Storage upload failed (${res.status}). Check the bucket exists and is public. ${detail.slice(0, 200)}`);
  }
  // Public URL for a public bucket.
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
