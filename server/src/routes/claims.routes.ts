import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { body } from 'express-validator';
import { authenticate, requireWrite } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  listClaims, getClaim, createClaim, decideClaim, uploadClaimDocument, aiReviewClaim,
} from '../controllers/claims.controller';

// Claim documents are received in-memory then streamed to Supabase Storage; cap
// at 10 MB so a stray large upload can't exhaust memory.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Wrap multer so its errors (e.g. file too large) return a clean 400 JSON body
// instead of falling through to the generic 500 handler.
function singleFile(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (err: unknown) => {
    if (err) {
      const code = (err as { code?: string }).code;
      const message = code === 'LIMIT_FILE_SIZE' ? 'File exceeds the 10 MB limit.' : 'File upload failed.';
      res.status(400).json({ error: message });
      return;
    }
    next();
  });
}

const router = Router();
router.use(authenticate);

// Reads open to all roles; create/decide/upload require write access.
router.get('/', asyncHandler(listClaims));
router.get('/:id', asyncHandler(getClaim));
router.post(
  '/',
  requireWrite,
  [body('memberId').notEmpty().withMessage('A member is required'),
   body('amount').isNumeric().withMessage('Amount must be a number')],
  validate,
  asyncHandler(createClaim)
);
router.patch(
  '/:id/decision',
  requireWrite,
  [body('status').notEmpty().withMessage('A status is required')],
  validate,
  asyncHandler(decideClaim)
);
router.post('/:id/documents', requireWrite, singleFile, asyncHandler(uploadClaimDocument));
router.post('/:id/ai-review', requireWrite, asyncHandler(aiReviewClaim));

export default router;
