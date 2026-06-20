-- Optional: a sample "Welcome" post so the blog isn't empty at launch.
-- Run AFTER 039-blog-posts.sql. Safe to re-run (ON CONFLICT). Edit or delete it
-- later from Admin Console → Blog.
INSERT INTO blog_posts (slug, title, excerpt, body, author, tags, status, published_at, meta_description)
VALUES (
  'welcome-to-the-mobicova-blog',
  'Welcome to the MobiCova blog',
  'Health information, product news and guides for the partners and members building a healthier Nigeria with MobiCova.',
  E'MobiCova is building digital health infrastructure for Nigeria and Africa — helping insurers, HMOs, employers and clinics reach people on any phone, in any language.\n\n## What you will find here\n\nProduct updates and new features, practical health guides (the same trusted information our free Health Buddy uses), and news for our partners across the ecosystem.\n\n## Try these now\n\n- The free **Health Buddy** for basic health questions\n- **Eze**, our assistant, for anything about MobiCova\n\nMore soon.',
  'MobiCova Health',
  '["announcements","mobicova"]'::jsonb,
  'published',
  now(),
  'Health information, product news and guides from MobiCova Health — digital health for Nigeria and Africa.'
)
ON CONFLICT (slug) DO NOTHING;
