import api from './client';

export type BlogListItem = {
  slug: string;
  title: string;
  excerpt: string;
  cover_image_url: string;
  author: string;
  tags: string[];
  published_at: string;
};

export type BlogPost = BlogListItem & {
  body: string;
  meta_title: string;
  meta_description: string;
};

export type AdminBlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_image_url: string;
  author: string;
  tags: string[];
  status: 'draft' | 'published';
  published_at: string | null;
  meta_title: string;
  meta_description: string;
  created_at: string;
  updated_at: string;
  state: 'draft' | 'scheduled' | 'live';
};

// ── Public ──
export async function listBlog(): Promise<BlogListItem[]> {
  return (await api.get('/blog')).data.posts;
}
export async function getBlogPost(slug: string): Promise<BlogPost> {
  return (await api.get(`/blog/${slug}`)).data;
}

// ── Admin (platform-admin) ──
export async function adminListBlog(): Promise<AdminBlogPost[]> {
  return (await api.get('/admin/blog')).data.posts;
}
export async function adminCreateBlog(data: Record<string, unknown>): Promise<{ id: string; slug: string }> {
  return (await api.post('/admin/blog', data)).data;
}
export async function adminUpdateBlog(id: string, data: Record<string, unknown>): Promise<{ id: string; slug: string }> {
  return (await api.patch(`/admin/blog/${id}`, data)).data;
}
export async function adminDeleteBlog(id: string): Promise<void> {
  await api.delete(`/admin/blog/${id}`);
}
