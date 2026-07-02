import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  getNotifications, markNotificationsRead, markAllNotificationsRead,
  getNotificationPrefs, updateNotificationPrefs,
  getSlackConfig, updateSlackConfig, testSlack,
} from '../controllers/notifications.controller';

// Per-user notifications feed + preferences. All endpoints are personal to the
// signed-in user (read state and prefs are per-user, feed is org-scoped).
const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(getNotifications));
router.post('/read', asyncHandler(markNotificationsRead));
router.post('/read-all', asyncHandler(markAllNotificationsRead));
router.get('/prefs', asyncHandler(getNotificationPrefs));
router.put('/prefs', asyncHandler(updateNotificationPrefs));

// Per-org Slack integration: any user can view; only admins connect/change/test.
router.get('/slack', asyncHandler(getSlackConfig));
router.put('/slack', requireRole('admin'), asyncHandler(updateSlackConfig));
router.post('/slack/test', requireRole('admin'), asyncHandler(testSlack));

export default router;
