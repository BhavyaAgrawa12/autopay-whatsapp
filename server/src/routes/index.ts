import { Router } from 'express';
import { healthRoutes } from './health.routes.js';
import { authRoutes } from './auth.routes.js';
import { companyRoutes } from './company.routes.js';
import { whatsappRoutes } from './whatsapp.routes.js';
import { webhookRoutes } from './webhook.routes.js';
import { campaignRoutes } from './campaign.routes.js';
import { contactRoutes } from './contact.routes.js';
import { contactListRoutes } from './contactList.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/company', companyRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/contacts', contactRoutes);
router.use('/contact-lists', contactListRoutes);

export const apiRouter = router;
