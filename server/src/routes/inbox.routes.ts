import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  getConversations,
  getConversationMessages,
  sendOutboundMessage,
  markRead,
  markUnread,
  getApprovedTemplates,
} from '../controllers/inbox.controller.js';

const router = Router();

// Protect all Inbox routes with Admin JWT authentication
router.use(requireAuth);

router.get('/conversations', getConversations);
router.get('/conversations/:id/messages', getConversationMessages);
router.post('/conversations/:id/messages', sendOutboundMessage);
router.patch('/conversations/:id/read', markRead);
router.patch('/conversations/:id/unread', markUnread);
router.get('/templates', getApprovedTemplates);

export const inboxRoutes = router;
