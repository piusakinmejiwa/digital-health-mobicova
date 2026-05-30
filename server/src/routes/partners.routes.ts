import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { listPartners } from '../controllers/partners.controller';

const router = Router();

router.use(authenticate);
router.get('/', listPartners);

export default router;
