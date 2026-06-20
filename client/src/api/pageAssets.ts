import api from './client';

// Public: page slug -> hero image URL (only pages that have one set).
export async function getPageAssets(): Promise<Record<string, string>> {
  return (await api.get('/page-assets')).data.assets || {};
}

export type PageAsset = { slug: string; image_url: string; prompt: string; updated_at: string };
export type PageAssetsResponse = { assets: PageAsset[]; generatorReady: boolean; provider: string };

export async function adminListPageAssets(): Promise<PageAssetsResponse> {
  return (await api.get('/admin/page-assets')).data;
}
export async function adminSavePageAsset(slug: string, imageUrl: string, prompt: string): Promise<void> {
  await api.put(`/admin/page-assets/${slug}`, { imageUrl, prompt });
}
// Generate an image from a prompt → returns the uploaded image URL (not yet saved to a page).
export async function adminGenerateImage(prompt: string): Promise<string> {
  return (await api.post('/admin/generate-image', { prompt })).data.url as string;
}
