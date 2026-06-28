import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, requireWrite } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  listMembers, getMember, createMember, importMembers, updateMember, deleteMember,
  createCareSummary,
} from '../controllers/members.controller';

const router = Router();

router.use(authenticate);

// Reads are open to every role (incl. read-only analysts); mutations require
// admin or manager (requireWrite).
router.get('/', asyncHandler(listMembers));
router.get('/:id', asyncHandler(getMember));
router.post('/', requireWrite, [body('fullName').trim().notEmpty().withMessage('Full name is required')], validate, asyncHandler(createMember));
router.post('/import', requireWrite, asyncHandler(importMembers));
router.put('/:id', requireWrite, asyncHandler(updateMember));
router.delete('/:id', requireWrite, asyncHandler(deleteMember));
router.post('/:id/care-summary', requireWrite, asyncHandler(createCareSummary));

export default router;
