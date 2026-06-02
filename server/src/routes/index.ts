import { Router } from 'express';
import authRoutes from './auth.routes';
import membersRoutes from './members.routes';
import partnersRoutes from './partners.routes';
import telemedicineRoutes from './telemedicine.routes';
import insuranceRoutes from './insurance.routes';
import triageRoutes from './triage.routes';
import dashboardRoutes from './dashboard.routes';
import billingRoutes from './billing.routes';
import channelsRoutes from './channels.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/members', membersRoutes);
router.use('/partners', partnersRoutes);
router.use('/consultations', telemedicineRoutes);
router.use('/insurance', insuranceRoutes);
router.use('/triage', triageRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/billing', billingRoutes);
router.use('/channels', channelsRoutes);

export default router;
