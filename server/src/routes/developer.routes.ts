import { Router } from 'express';
import { body } from 'express-validator';
import {
  listApiKeys, createApiKey, revokeApiKey,
  listEvents, listWebhooks, createWebhook, updateWebhook, deleteWebhook,
  testWebhook, listDeliveries, consoleQuery,
} from '../controllers/developer.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';

// Org-admin management of the public API (keys + webhooks). Read/catalogue is
// open to any signed-in admin; all mutations require the admin role.
const router = Router();

router.use(authenticate);
const adminOnly = requireRole('admin');

router.get('/events', listEvents);

// API console — real org-scoped data in the public-API shape (admin).
router.get('/console', adminOnly, asyncHandler(consoleQuery));

// API keys
router.get('/api-keys', adminOnly, asyncHandler(listApiKeys));
router.post('/api-keys', adminOnly, asyncHandler(createApiKey));
router.delete('/api-keys/:id', adminOnly, asyncHandler(revokeApiKey));

// Webhooks
router.get('/webhooks', adminOnly, asyncHandler(listWebhooks));
router.post('/webhooks', adminOnly, [body('url').trim().notEmpty()], validate, asyncHandler(createWebhook));
router.patch('/webhooks/:id', adminOnly, asyncHandler(updateWebhook));
router.delete('/webhooks/:id', adminOnly, asyncHandler(deleteWebhook));
router.post('/webhooks/:id/test', adminOnly, asyncHandler(testWebhook));
router.get('/webhooks/:id/deliveries', adminOnly, asyncHandler(listDeliveries));

export default router;
