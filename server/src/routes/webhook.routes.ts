import { Router } from 'express';
import { verifyWebhook, handleWebhook } from '../controllers/webhook.controller.js';

const router = Router();

// Public Unauthenticated Webhook Routes for Meta WhatsApp Cloud API
router.get('/whatsapp', verifyWebhook);
router.post('/whatsapp', handleWebhook);

export const webhookRoutes = router;
