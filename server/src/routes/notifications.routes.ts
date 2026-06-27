import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  getNotifications, markNotificationsRead, markAllNotificationsRead,
  getNotificationPrefs, updateNotificationPrefs,
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

export default router;
