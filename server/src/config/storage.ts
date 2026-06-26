import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

// Optional Supabase Storage integration for claim documents. When SUPABASE_URL
// and a service-role key are present we upload files to a private bucket and
// return a long-lived signed URL; otherwise storage is disabled and the Claims
// module degrades gracefully (text-only claims), mirroring the Stripe/Anthropic
// fallbacks elsewhere in the app.
const client: SupabaseClient | null =
  env.supabaseUrl && env.supabaseServiceRoleKey
    ? createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export const storageEnabled = !!client;

export interface StoredFile {
  url: string;
  path: string;
}

export interface UploadableFile {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
}

// Uploads a claim's supporting file to the configured private bucket and returns
// a signed URL valid for one year (long enough for the partner UI to display or
// download it; the storage_path is persisted so a fresh URL can be minted later).
export async function uploadClaimFile(claimId: string, file: UploadableFile): Promise<StoredFile> {
  if (!client) throw new Error('storage_disabled');

  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'file';
  const path = `${claimId}/${Date.now()}-${safeName}`;

  const { error } = await client.storage
    .from(env.supabaseStorageBucket)
    .upload(path, file.buffer, { contentType: file.mimetype || 'application/octet-stream', upsert: false });
  if (error) throw error;

  const { data, error: signErr } = await client.storage
    .from(env.supabaseStorageBucket)
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signErr) throw signErr;

  return { url: data.signedUrl, path };
}

// Upload an organisation onboarding document to the private bucket. We persist
// only the storage_path and mint a short-lived signed URL on read (so links
// can't leak permanently). Files are namespaced under org-<id>/.
export async function uploadOrgFile(orgId: string, file: UploadableFile): Promise<{ path: string }> {
  if (!client) throw new Error('storage_disabled');
  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'file';
  const path = `org-${orgId}/${Date.now()}-${safeName}`;
  const { error } = await client.storage
    .from(env.supabaseStorageBucket)
    .upload(path, file.buffer, { contentType: file.mimetype || 'application/octet-stream', upsert: false });
  if (error) throw error;
  return { path };
}

// Mint a fresh signed URL for a stored path (default 1 hour). Null if storage off.
export async function signedUrlForPath(path: string, seconds = 60 * 60): Promise<string | null> {
  if (!client || !path) return null;
  const { data, error } = await client.storage.from(env.supabaseStorageBucket).createSignedUrl(path, seconds);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function deleteStoredFile(path: string): Promise<void> {
  if (!client || !path) return;
  await client.storage.from(env.supabaseStorageBucket).remove([path]);
}
