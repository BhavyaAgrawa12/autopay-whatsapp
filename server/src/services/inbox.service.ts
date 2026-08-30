import mongoose from 'mongoose';
import { Conversation, IConversation } from '../models/Conversation.model.js';
import { Message, IMessage, InboxMessageType, InboxMessageStatus } from '../models/Message.model.js';
import { Contact } from '../models/Contact.model.js';
import { WhatsAppService, WATemplate } from './whatsapp.service.js';
import { normalizePhoneNumber, formatPhoneForDisplay } from '../utils/phone.js';
import { AppError, NotFoundError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// Status hierarchy rank for non-downgrading status precedence
const STATUS_RANK: Record<string, number> = {
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
  FAILED: 3,
};

export class InboxService {
  /**
   * Process a real incoming message from Meta Webhook
   */
  public static async processInboundWebhookMessage(msgData: {
    wamid: string;
    senderPhone: string;
    timestampSec?: number;
    type?: string;
    textBody?: string;
    mediaId?: string;
    businessPhone?: string;
  }): Promise<{ conversation: IConversation; message: IMessage | null; duplicate: boolean }> {
    const { wamid, senderPhone, timestampSec, type = 'text', textBody = '', mediaId = '', businessPhone = '' } = msgData;

    if (!wamid || !senderPhone) {
      throw new ValidationError('Webhook payload missing wamid or sender phone');
    }

    const cleanWamid = wamid.trim();
    const normalizedPhone = normalizePhoneNumber(senderPhone);
    const eventDate = timestampSec ? new Date(timestampSec * 1000) : new Date();

    // 1. Idempotency Check: Don't create duplicate Message
    const existingMessage = await Message.findOne({ whatsappMessageId: cleanWamid });
    if (existingMessage) {
      logger.info('[InboxService] Idempotent duplicate inbound message ignored', {
        wamidSuffix: cleanWamid.slice(-8),
      });
      const conversation = await Conversation.findById(existingMessage.conversationId);
      return { conversation: conversation!, message: existingMessage, duplicate: true };
    }

    // 2. Contact Matching: Lookup existing Contact by phoneNormalized
    let contact = await Contact.findOne({ phoneNormalized: normalizedPhone });
    if (!contact) {
      // Also check 10-digit suffix if applicable
      const suffix10 = normalizedPhone.slice(-10);
      contact = await Contact.findOne({ phoneNormalized: { $regex: new RegExp(`${suffix10}$`) } });
    }

    // 3. Find or Create Conversation
    let conversation = await Conversation.findOne({ phoneNumber: normalizedPhone });
    const formattedDisplay = contact ? contact.name : formatPhoneForDisplay(normalizedPhone);

    if (!conversation) {
      conversation = await Conversation.create({
        contactId: contact ? contact._id : null,
        phoneNumber: normalizedPhone,
        phoneRaw: senderPhone,
        displayName: formattedDisplay,
        lastMessage: textBody || `[${type.toUpperCase()}]`,
        lastMessageAt: eventDate,
        unreadCount: 1,
        lastInboundAt: eventDate,
        messagingWindowExpiresAt: new Date(eventDate.getTime() + 24 * 60 * 60 * 1000), // 24 Hours
      });
    } else {
      // Update linked contact if not previously linked
      if (contact && !conversation.contactId) {
        conversation.contactId = contact._id as mongoose.Types.ObjectId;
        conversation.displayName = contact.name;
      }

      conversation.lastMessage = textBody || `[${type.toUpperCase()}]`;
      conversation.lastMessageAt = eventDate;
      conversation.lastInboundAt = eventDate;
      conversation.messagingWindowExpiresAt = new Date(eventDate.getTime() + 24 * 60 * 60 * 1000); // 24 Hours
      conversation.unreadCount = (conversation.unreadCount || 0) + 1;
      await conversation.save();
    }

    // 4. Map messageType
    let msgType: InboxMessageType = 'TEXT';
    const typeUpper = type.toUpperCase();
    if (['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER'].includes(typeUpper)) {
      msgType = typeUpper as InboxMessageType;
    } else if (typeUpper !== 'TEXT') {
      msgType = 'UNKNOWN';
    }

    // 5. Create Message Record
    let message: IMessage;
    try {
      message = await Message.create({
        conversationId: conversation._id,
        whatsappMessageId: cleanWamid,
        direction: 'INBOUND',
        messageType: msgType,
        text: textBody || (msgType !== 'TEXT' ? `[${msgType}]` : ''),
        mediaId: mediaId,
        from: normalizedPhone,
        to: businessPhone || 'BUSINESS',
        status: 'DELIVERED',
        sentAt: eventDate,
        deliveredAt: eventDate,
      });
    } catch (err: any) {
      if (err.code === 11000) {
        // Handle race condition duplicate
        const existingMsg = await Message.findOne({ whatsappMessageId: cleanWamid });
        return { conversation, message: existingMsg, duplicate: true };
      }
      throw err;
    }

    logger.info('[InboxService] Inbound message ingested successfully', {
      phoneSuffix: normalizedPhone.slice(-4),
      wamidSuffix: cleanWamid.slice(-8),
      msgType,
    });

    return { conversation, message, duplicate: false };
  }

  /**
   * Process a status update event (SENT, DELIVERED, READ, FAILED) for an Inbox message
   */
  public static async processStatusWebhookMessage(statusData: {
    wamid: string;
    statusStr: string;
    timestampSec?: number;
    errorCode?: number | string;
    errorMessage?: string;
  }): Promise<boolean> {
    const { wamid, statusStr, timestampSec, errorCode, errorMessage } = statusData;
    if (!wamid) return false;

    const cleanWamid = wamid.trim();
    const targetStatus = statusStr.toUpperCase() as InboxMessageStatus;

    if (!['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(targetStatus)) {
      return false;
    }

    const message = await Message.findOne({ whatsappMessageId: cleanWamid });
    if (!message) {
      return false; // Not an Inbox message (or Campaign message handled elsewhere)
    }

    const currentRank = STATUS_RANK[message.status] || 0;
    const targetRank = STATUS_RANK[targetStatus] || 0;
    const eventDate = timestampSec ? new Date(timestampSec * 1000) : new Date();

    if (targetStatus === 'FAILED') {
      message.status = 'FAILED';
      message.failedAt = eventDate;
      message.errorCode = String(errorCode || 'META_DELIVERY_FAILURE');
      message.errorMessage = errorMessage || 'Meta reported delivery failure';
    } else if (targetRank > currentRank && message.status !== 'FAILED') {
      message.status = targetStatus;
    }

    if (targetStatus === 'SENT' && !message.sentAt) message.sentAt = eventDate;
    if (targetStatus === 'DELIVERED') {
      if (!message.deliveredAt) message.deliveredAt = eventDate;
      if (!message.sentAt) message.sentAt = eventDate;
    }
    if (targetStatus === 'READ') {
      if (!message.readAt) message.readAt = eventDate;
      if (!message.deliveredAt) message.deliveredAt = eventDate;
      if (!message.sentAt) message.sentAt = eventDate;
    }

    await message.save();

    logger.info('[InboxService] Message status updated', {
      wamidSuffix: cleanWamid.slice(-8),
      resultingStatus: message.status,
    });

    return true;
  }

  /**
   * Send an outbound reply (Text or Template) from Admin Inbox
   */
  public static async sendOutboundReply(data: {
    conversationId: string;
    text?: string;
    templateName?: string;
    languageCode?: string;
    variables?: Record<string, string>;
  }): Promise<{ message: IMessage; conversation: IConversation }> {
    const { conversationId, text, templateName, languageCode = 'en', variables } = data;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    const isTemplate = !!templateName;
    const cleanText = (text || '').trim();

    if (!isTemplate && !cleanText) {
      throw new ValidationError('Message text content cannot be empty');
    }

    if (!isTemplate && cleanText.length > 4096) {
      throw new ValidationError('Message text exceeds maximum length of 4096 characters');
    }

    // Customer Service 24-Hour Window Validation
    const now = new Date();
    const isWindowActive = conversation.messagingWindowExpiresAt
      ? conversation.messagingWindowExpiresAt.getTime() > now.getTime()
      : false;

    if (!isTemplate && !isWindowActive) {
      throw new AppError(
        'Customer service 24-hour window has expired. Meta policy requires sending an approved WhatsApp template.',
        400,
        'WINDOW_EXPIRED'
      );
    }

    let wamid = '';
    let sendStatus = 'SENT';
    let messageType: InboxMessageType = 'TEXT';
    let textBodyToStore = cleanText;

    if (isTemplate) {
      messageType = 'TEMPLATE';
      // Verify template is approved
      const templates = await WhatsAppService.fetchTemplates();
      const matched = templates.find((t) => t.name === templateName && t.status === 'APPROVED');
      if (!matched) {
        throw new ValidationError(`Template '${templateName}' is not approved by Meta or does not exist`);
      }

      const res = await WhatsAppService.sendTemplateMessage({
        recipientPhone: conversation.phoneNumber,
        templateName,
        languageCode,
        bodyVariables: variables,
      });
      wamid = res.messageId;
      textBodyToStore = `[Template: ${templateName}]`;
    } else {
      messageType = 'TEXT';
      const res = await WhatsAppService.sendTextMessage({
        recipientPhone: conversation.phoneNumber,
        text: cleanText,
      });
      wamid = res.messageId;
    }

    // Create Outbound Message Record
    const message = await Message.create({
      conversationId: conversation._id,
      whatsappMessageId: wamid,
      direction: 'OUTBOUND',
      messageType,
      text: textBodyToStore,
      from: 'BUSINESS',
      to: conversation.phoneNumber,
      status: 'SENT',
      sentAt: now,
    });

    // Update Conversation
    conversation.lastMessage = textBodyToStore;
    conversation.lastMessageAt = now;
    conversation.lastOutboundAt = now;
    await conversation.save();

    logger.info('[InboxService] Outbound reply sent successfully', {
      conversationId,
      wamidSuffix: wamid.slice(-8),
      isTemplate,
    });

    return { message, conversation };
  }

  /**
   * Fetch conversations list with pagination & search
   */
  public static async getConversations(params: {
    search?: string;
    filter?: 'all' | 'unread';
    page?: number;
    limit?: number;
  }): Promise<{ conversations: IConversation[]; total: number; page: number; pages: number }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const query: any = {};

    if (params.filter === 'unread') {
      query.unreadCount = { $gt: 0 };
    }

    if (params.search && params.search.trim().length > 0) {
      const sanitized = params.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { displayName: { $regex: sanitized, $options: 'i' } },
        { phoneNumber: { $regex: sanitized, $options: 'i' } },
        { lastMessage: { $regex: sanitized, $options: 'i' } },
      ];
    }

    const [conversations, total] = await Promise.all([
      Conversation.find(query).sort({ lastMessageAt: -1 }).skip(skip).limit(limit).exec(),
      Conversation.countDocuments(query),
    ]);

    return {
      conversations,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Fetch messages for a specific conversation with pagination
   */
  public static async getConversationMessages(
    conversationId: string,
    params: { page?: number; limit?: number; beforeId?: string }
  ): Promise<{ messages: IMessage[]; total: number; conversation: IConversation }> {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 50));
    const skip = (page - 1) * limit;

    const query: any = { conversationId: conversation._id };

    if (params.beforeId && mongoose.Types.ObjectId.isValid(params.beforeId)) {
      query._id = { $lt: new mongoose.Types.ObjectId(params.beforeId) };
    }

    const [messagesDesc, total] = await Promise.all([
      Message.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      Message.countDocuments({ conversationId: conversation._id }),
    ]);

    // Reverse to return messages in ascending chronological order for UI display
    const messages = messagesDesc.reverse();

    return { messages, total, conversation };
  }

  /**
   * Mark conversation as read (reset unread count)
   */
  public static async markConversationRead(conversationId: string): Promise<IConversation> {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }
    conversation.unreadCount = 0;
    await conversation.save();
    return conversation;
  }

  /**
   * Mark conversation as unread
   */
  public static async markConversationUnread(conversationId: string): Promise<IConversation> {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }
    conversation.unreadCount = Math.max(1, (conversation.unreadCount || 0) + 1);
    await conversation.save();
    return conversation;
  }

  /**
   * Fetch APPROVED WhatsApp templates for fallback replies
   */
  public static async getApprovedTemplates(): Promise<WATemplate[]> {
    const templates = await WhatsAppService.fetchTemplates();
    return templates.filter((t) => t.status === 'APPROVED');
  }
}
