import { Router } from 'express';
import authRoutes from './auth.routes';
import membersRoutes from './members.routes';
import partnersRoutes from './partners.routes';
import telemedicineRoutes from './telemedicine.routes';
import insuranceRoutes from './insurance.routes';
import triageRoutes from './triage.routes';
import dashboardRoutes from './dashboard.routes';
import analyticsRoutes from './analytics.routes';
import claimsRoutes from './claims.routes';
import ssoRoutes from './sso.routes';
import billingRoutes from './billing.routes';
import channelsRoutes from './channels.routes';
import adminRoutes from './admin.routes';
import memberPortalRoutes from './memberPortal.routes';
import developerRoutes from './developer.routes';
import providerRoutes from './provider.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/members', membersRoutes);
router.use('/partners', partnersRoutes);
router.use('/consultations', telemedicineRoutes);
router.use('/insurance', insuranceRoutes);
router.use('/triage', triageRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/claims', claimsRoutes);
router.use('/sso', ssoRoutes);
router.use('/billing', billingRoutes);
router.use('/channels', channelsRoutes);
router.use('/admin', adminRoutes);
router.use('/member', memberPortalRoutes);
router.use('/developer', developerRoutes);
router.use('/provider', providerRoutes);

export default router;
