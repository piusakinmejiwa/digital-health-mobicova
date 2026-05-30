import { Router } from 'express';
import authRoutes from './auth.routes';
import membersRoutes from './members.routes';
import partnersRoutes from './partners.routes';
import telemedicineRoutes from './telemedicine.routes';
import insuranceRoutes from './insurance.routes';
import triageRoutes from './triage.routes';
import dashboardRoutes from './dashboard.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/members', membersRoutes);
router.use('/partners', partnersRoutes);
router.use('/consultations', telemedicineRoutes);
router.use('/insurance', insuranceRoutes);
router.use('/triage', triageRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
