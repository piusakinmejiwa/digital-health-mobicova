import { env } from '../config/env';

// Provider-agnostic AI image generation. Defaults to OpenAI (gpt-image-1).
// Add the matching API key to enable it. Returns raw image bytes which the caller
// uploads to storage. New providers can be added behind the same generateImage().

export function imagegenConfigured(): boolean {
  if (env.imageProvider === 'openai') return !!env.openaiApiKey;
  return false; // other providers can be wired here later
}

export function imagegenProviderLabel(): string {
  return env.imageProvider === 'openai' ? 'OpenAI (gpt-image-1)' : env.imageProvider;
}

async function generateOpenAI(prompt: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.openaiApiKey}`, 'Content-Type': 'application/json' },
    // Size + quality are configurable to control cost (IMAGE_SIZE / IMAGE_QUALITY).
    body: JSON.stringify({ model: 'gpt-image-1', prompt, size: env.imageSize, quality: env.imageQuality, n: 1 }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Image generation failed (${res.status}). ${detail.slice(0, 240)}`);
  }
  const data = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error('The image provider returned no image.');
  return { buffer: Buffer.from(b64, 'base64'), contentType: 'image/png' };
}

export async function generateImage(prompt: string): Promise<{ buffer: Buffer; contentType: string }> {
  if (!imagegenConfigured()) {
    throw new Error('AI image generation is not configured. Set OPENAI_API_KEY (and IMAGE_PROVIDER=openai) on the API service.');
  }
  if (env.imageProvider === 'openai') return generateOpenAI(prompt);
  throw new Error(`Unsupported image provider: ${env.imageProvider}`);
}
