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
