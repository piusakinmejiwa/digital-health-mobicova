import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  listMembers, getMember, createMember, updateMember, deleteMember,
} from '../controllers/members.controller';

const router = Router();

router.use(authenticate);

router.get('/', listMembers);
router.get('/:id', getMember);
router.post('/', [body('fullName').trim().notEmpty().withMessage('Full name is required')], validate, createMember);
router.put('/:id', updateMember);
router.delete('/:id', deleteMember);

export default router;
