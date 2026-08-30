import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { CampaignRecipient, RecipientSendStatus } from '../models/CampaignRecipient.model.js';
import { MessageEvent, MessageEventStatus } from '../models/MessageEvent.model.js';

// Status hierarchy rank for non-downgrading status precedence
const STATUS_RANK: Record<string, number> = {
  QUEUED: 0,
  SENDING: 1,
  SENT: 2,
  DELIVERED: 3,
  READ: 4,
  FAILED: 5,
  CANCELLED: 5,
};

/**
 * Validates X-Hub-Signature-256 against raw body buffer
 */
function verifyWebhookSignature(req: Request): boolean {
  if (!env.WHATSAPP_APP_SECRET || env.WHATSAPP_APP_SECRET.trim().length === 0) {
    logger.info('[WhatsApp Webhook] App secret not configured, bypassing HMAC check');
    return true;
  }

  const signatureHeader = req.headers['x-hub-signature-256'] as string;
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    logger.warn('[WhatsApp Webhook] Missing or malformed X-Hub-Signature-256 header');
    return false;
  }

  const expectedSignature = signatureHeader.substring(7);
  const rawData = (req as any).rawBody || Buffer.from(JSON.stringify(req.body || {}));

  const calculatedSignature = crypto
    .createHmac('sha256', env.WHATSAPP_APP_SECRET)
    .update(rawData)
    .digest('hex');

  try {
    const matched = crypto.timingSafeEqual(Buffer.from(expectedSignature, 'hex'), Buffer.from(calculatedSignature, 'hex'));
    if (!matched) {
      logger.warn('[WhatsApp Webhook] HMAC signature verification failed');
    } else {
      logger.info('[WhatsApp Webhook] HMAC signature verification passed');
    }
    return matched;
  } catch (e) {
    logger.warn('[WhatsApp Webhook] HMAC comparison error');
    return false;
  }
}

/**
 * GET /api/webhooks/whatsapp
 * Meta Webhook Challenge Verification
 */
export function verifyWebhook(req: Request, res: Response): void {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  if (mode === 'subscribe' && token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    logger.info('[WhatsApp Webhook] Verification challenge successful');
    res.status(200).send(challenge);
    return;
  }

  logger.warn('[WhatsApp Webhook] Verification challenge failed - invalid token or mode');
  res.status(403).json({ error: 'Webhook verification token mismatch' });
}

/**
 * POST /api/webhooks/whatsapp
 * Meta Webhook Event Notification Handler
 */
export async function handleWebhook(req: Request, res: Response, _next: NextFunction): Promise<void> {
  // 1. Verify HMAC SHA-256 Signature BEFORE payload processing
  if (!verifyWebhookSignature(req)) {
    logger.warn('[WhatsApp Webhook] Rejected webhook - signature validation failed');
    res.status(403).json({ error: 'Invalid webhook signature' });
    return;
  }

  // 2. Acknowledge Meta immediately with HTTP 200 OK
  res.status(200).json({ success: true, message: 'EVENT_RECEIVED' });

  // 3. Process status events asynchronously
  try {
    const body = req.body;

    if (!body || body.object !== 'whatsapp_business_account' || !Array.isArray(body.entry)) {
      return; // Ignore non-WhatsApp or malformed webhook payloads safely
    }

    for (const entry of body.entry) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'messages' || !change.value) continue;

        const value = change.value;
        const statuses = value.statuses || [];
        const messages = value.messages || [];

        // Safe temporary diagnostic logging for REAL incoming message events
        for (const msg of messages) {
          const senderPhone = String(msg.from || '');
          const msgId = String(msg.id || '');
          const msgType = String(msg.type || 'unknown');

          logger.info('[WhatsApp Webhook] Real incoming message event received', {
            eventType: change.field,
            messageType: msgType,
            senderPhoneSuffix: senderPhone.length >= 4 ? senderPhone.slice(-4) : senderPhone,
            messageIdSuffix: msgId.length >= 8 ? msgId.slice(-8) : msgId,
            received: true,
          });
        }

        for (const statusItem of statuses) {
          const rawMessageId = statusItem.id || '';
          const messageId = rawMessageId.trim();
          const statusStr = (statusItem.status || '').toUpperCase();
          const timestampSec = statusItem.timestamp ? parseInt(statusItem.timestamp, 10) : Math.floor(Date.now() / 1000);
          const eventDate = new Date(timestampSec * 1000);

          if (!messageId || !['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(statusStr)) {
            continue; // Skip invalid status fields safely
          }

          const targetStatus = statusStr as MessageEventStatus;

          // A. Lookup recipient by exact whatsappMessageId
          let recipient = await CampaignRecipient.findOne({ whatsappMessageId: messageId });
          if (!recipient && messageId) {
            recipient = await CampaignRecipient.findOne({
              whatsappMessageId: { $regex: new RegExp(`^${messageId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            });
          }

          // Safe development diagnostics (User directive)
          logger.info('[WhatsApp Webhook] Event received', {
            eventType: change.field,
            status: statusItem.status,
            wamidSuffix: messageId ? messageId.slice(-8) : '',
            recipientMatched: !!recipient,
          });

          if (!recipient) {
            logger.warn('[WhatsApp Webhook] Unknown message ID received', {
              wamidSuffix: messageId ? messageId.slice(-8) : '',
            });
            continue;
          }

          // Extract error details if status is FAILED
          let errorCode: number | string | undefined = undefined;
          let errorTitle: string | undefined = undefined;
          if (targetStatus === 'FAILED' && Array.isArray(statusItem.errors) && statusItem.errors.length > 0) {
            errorCode = statusItem.errors[0].code;
            errorTitle = statusItem.errors[0].title || statusItem.errors[0].message;
          }

          // B. Idempotency: Create MessageEvent record (Unique index on [whatsappMessageId, status] prevents duplicates)
          try {
            await MessageEvent.create({
              campaignId: recipient.campaignId,
              campaignRecipientId: recipient._id,
              whatsappMessageId: messageId,
              status: targetStatus,
              eventTimestamp: eventDate,
              receivedAt: new Date(),
              errorCode,
              errorTitle,
            });
          } catch (err: any) {
            if (err.code === 11000) {
              logger.info('[WhatsApp Webhook] Idempotent duplicate event recorded', {
                wamidSuffix: messageId.slice(-8),
                status: targetStatus,
              });
            } else {
              logger.error('[WhatsApp Webhook] Failed to persist MessageEvent', { error: err.message });
            }
          }

          // C. Update Recipient Timestamps safely
          if (targetStatus === 'SENT' && !recipient.sentAt) {
            recipient.sentAt = eventDate;
          }
          if (targetStatus === 'DELIVERED') {
            if (!recipient.deliveredAt) recipient.deliveredAt = eventDate;
            if (!recipient.sentAt) recipient.sentAt = eventDate;
          }
          if (targetStatus === 'READ') {
            if (!recipient.readAt) recipient.readAt = eventDate;
            if (!recipient.deliveredAt) recipient.deliveredAt = eventDate;
            if (!recipient.sentAt) recipient.sentAt = eventDate;
          }

          // D. Update Recipient Status following non-downgrading status precedence
          const currentRank = STATUS_RANK[recipient.status] || 0;
          const targetRank = STATUS_RANK[targetStatus] || 0;

          if (targetStatus === 'FAILED') {
            recipient.status = 'FAILED';
            recipient.errorCode = String(errorCode || 'META_DELIVERY_FAILURE');
            recipient.errorReason = errorTitle || 'Meta reported message delivery failure';
          } else if (targetRank > currentRank && recipient.status !== 'FAILED') {
            recipient.status = targetStatus as RecipientSendStatus;
          }

          await recipient.save();
          logger.info('[WhatsApp Webhook] CampaignRecipient status updated', {
            wamidSuffix: messageId.slice(-8),
            resultingStatus: recipient.status,
          });
        }
      }
    }
  } catch (err: any) {
    logger.error('[WhatsApp Webhook] Error processing background webhook event', { error: err.message });
  }
}
