import { Request, Response, NextFunction } from 'express';
import { WhatsAppService } from '../services/whatsapp.service.js';

export async function getWhatsAppStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = await WhatsAppService.getStatus();
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
}

export async function testWhatsAppConnection(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await WhatsAppService.testConnection();
    res.status(result.connected ? 200 : 400).json({
      success: result.connected,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getTemplates(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let templates = WhatsAppService.getCachedTemplates();
    if (templates.length === 0) {
      templates = await WhatsAppService.fetchTemplates();
    }
    res.status(200).json({
      success: true,
      data: templates,
    });
  } catch (error) {
    next(error);
  }
}

export async function syncTemplates(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const templates = await WhatsAppService.fetchTemplates();
    res.status(200).json({
      success: true,
      data: templates,
    });
  } catch (error) {
    next(error);
  }
}

export async function sendTestMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { recipientPhone, templateName, languageCode, variables } = req.body;

    const result = await WhatsAppService.sendTestMessage({
      recipientPhone,
      templateName,
      languageCode,
      variables,
    });

    res.status(200).json({
      success: true,
      data: {
        message: 'Test message sent successfully',
        messageId: result.messageId,
      },
    });
  } catch (error) {
    next(error);
  }
}
