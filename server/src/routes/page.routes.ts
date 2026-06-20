import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { publicPageAssets } from '../controllers/pageAssets.controller';

const router = Router();

// Public: page slug -> hero image URL map, for the content pages.
router.get('/', asyncHandler(publicPageAssets));

export default router;
