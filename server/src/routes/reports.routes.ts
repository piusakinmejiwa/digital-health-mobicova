import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { runScheduledReports } from '../controllers/reports.controller';

// Scheduled client reports — the cron trigger. Fired by an external scheduler
// (Render Cron / cron-job.org / GitHub Actions), guarded by REPORTS_CRON_SECRET.
// Admin configuration (subscriptions, preview, send-now) lives under /admin.
const router = Router();

router.post('/run', asyncHandler(runScheduledReports));

export default router;
