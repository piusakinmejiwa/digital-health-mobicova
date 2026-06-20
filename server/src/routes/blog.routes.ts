import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { listPublishedPosts, getPublishedPost, blogSitemap } from '../controllers/blog.controller';

const router = Router();

// Public, unauthenticated blog feed. /sitemap.xml must precede /:slug.
router.get('/', asyncHandler(listPublishedPosts));
router.get('/sitemap.xml', asyncHandler(blogSitemap));
router.get('/:slug', asyncHandler(getPublishedPost));

export default router;
