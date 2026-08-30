import { Request, Response, NextFunction } from 'express';
import { InboxService } from '../services/inbox.service.js';

export async function getConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const search = req.query.search as string;
    const filter = req.query.filter as 'all' | 'unread';
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const result = await InboxService.getConversations({ search, filter, page, limit });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getConversationMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const beforeId = req.query.beforeId as string;

    const result = await InboxService.getConversationMessages(id, { page, limit, beforeId });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function sendOutboundMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { text, templateName, languageCode, variables } = req.body;

    const result = await InboxService.sendOutboundReply({
      conversationId: id,
      text,
      templateName,
      languageCode,
      variables,
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const conversation = await InboxService.markConversationRead(id);
    res.json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
}

export async function markUnread(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const conversation = await InboxService.markConversationUnread(id);
    res.json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
}

export async function getApprovedTemplates(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const templates = await InboxService.getApprovedTemplates();
    res.json({ success: true, data: templates });
  } catch (error) {
    next(error);
  }
}
