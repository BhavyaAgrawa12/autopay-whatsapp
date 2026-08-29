import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  getWhatsAppStatus,
  testWhatsAppConnection,
  getTemplates,
  syncTemplates,
  sendTestMessage,
  debugWabaSubscription,
} from '../controllers/whatsapp.controller.js';

const router = Router();

// Protect all WhatsApp admin management routes
router.use(requireAuth);

const sendTestMessageSchema = z.object({
  recipientPhone: z.string().min(8, 'Valid recipient phone number is required'),
  templateName: z.string().min(1, 'Template name is required'),
  languageCode: z.string().min(2, 'Language code is required'),
  variables: z.record(z.string()).optional(),
});

router.get('/status', getWhatsAppStatus);
router.post('/test-connection', testWhatsAppConnection);
router.get('/debug-waba', debugWabaSubscription);
router.get('/templates', getTemplates);
router.post('/templates/sync', syncTemplates);
router.post('/send-test', validateRequest({ body: sendTestMessageSchema }), sendTestMessage);

export const whatsappRoutes = router;
