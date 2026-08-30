import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Campaign, ICampaign, CampaignStatus } from '../models/Campaign.model.js';
import { CampaignRecipient, ICampaignRecipient } from '../models/CampaignRecipient.model.js';
import { Contact } from '../models/Contact.model.js';
import { CompanyAsset } from '../models/CompanyAsset.model.js';
import { WhatsAppService } from './whatsapp.service.js';
import { ASSETS_MEDIA_DIR } from '../utils/fileStorage.js';
import { normalizePhoneNumber } from '../utils/phone.js';
import { AppError, ValidationError, NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface CampaignProgressMetrics {
  total: number;
  queued: number;
  sending: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  processed: number;
  percentage: number;
  status: CampaignStatus;
}

export class CampaignSendingService {
  private static activeRunners = new Set<string>();

  /**
   * On server startup, detect campaigns that were marked RUNNING or QUEUED
   * and update them to INTERRUPTED.
   */
  public static async recoverInterruptedCampaigns(): Promise<void> {
    try {
      const interrupted = await Campaign.updateMany(
        { status: { $in: ['RUNNING', 'QUEUED'] } },
        { $set: { status: 'INTERRUPTED' } }
      );
      if (interrupted.modifiedCount > 0) {
        logger.warn(`[CampaignEngine] Marked ${interrupted.modifiedCount} interrupted campaign(s) as INTERRUPTED on boot`);
      }
    } catch (err) {
      logger.error('[CampaignEngine] Failed to run restart recovery', { error: err });
    }
  }

  /**
   * Validates and starts background bulk sending for a campaign.
   */
  public static async startCampaign(campaignId: string, overrideRecipients?: any[]): Promise<{ campaignId: string; status: string; totalJobs: number }> {
    const isObjId = mongoose.Types.ObjectId.isValid(campaignId);
    const campaign = await Campaign.findOne({
      $or: [
        { campaignId: campaignId },
        ...(isObjId ? [{ _id: new mongoose.Types.ObjectId(campaignId) }] : []),
      ],
    });

    if (!campaign) {
      throw new NotFoundError(`Campaign '${campaignId}' not found.`);
    }

    // Safety validation for template status (do NOT send if IN_REVIEW or PENDING)
    if (campaign.templateStatus && ['IN_REVIEW', 'PENDING', 'REJECTED'].includes(campaign.templateStatus.toUpperCase())) {
      throw new ValidationError('Campaign cannot be started because the selected WhatsApp template is not approved yet.');
    }

    // Auto-clean stale RUNNING campaigns whose runners have ended
    const runningCampaigns = await Campaign.find({ status: 'RUNNING' });
    for (const rCamp of runningCampaigns) {
      if (rCamp.campaignId !== campaignId && !CampaignSendingService.activeRunners.has(rCamp.campaignId)) {
        rCamp.status = 'INTERRUPTED';
        await rCamp.save();
      }
    }

    // Check if another campaign is actively running
    const activeRunningCount = await Campaign.countDocuments({ status: 'RUNNING', campaignId: { $ne: campaignId } });
    if (activeRunningCount > 0) {
      throw new ValidationError('Another campaign is currently running. Please wait for it to complete or pause it.');
    }

    // 1. Fetch eligible contacts from MongoDB
    let eligibleContacts: any[] = [];

    if (overrideRecipients && overrideRecipients.length > 0) {
      const validOptedIn = overrideRecipients.filter(
        (r) => r.marketingOptIn !== 'OPTED_OUT' && r.optInStatus !== 'OPTED_OUT'
      );

      const targetObjectIds = validOptedIn
        .map((r) => r._id || r.id)
        .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      const targetNormalizedPhones = validOptedIn
        .map((r) => normalizePhoneNumber(r.phoneNormalized || r.phoneRaw || r.phone))
        .filter(Boolean);

      const existingContacts = await Contact.find({
        $or: [
          ...(targetObjectIds.length > 0 ? [{ _id: { $in: targetObjectIds } }] : []),
          ...(targetNormalizedPhones.length > 0 ? [{ phoneNormalized: { $in: targetNormalizedPhones } }] : []),
        ],
      });

      const existingIdSet = new Set(existingContacts.map((c) => c._id.toString()));
      const existingPhoneMap = new Map(existingContacts.map((c) => [c.phoneNormalized, c]));

      eligibleContacts = [...existingContacts];

      const newContactsToInsert: any[] = [];
      validOptedIn.forEach((r) => {
        const idStr = r._id || r.id;
        const rawPh = r.phoneRaw || r.phoneNormalized || r.phone;
        const normPh = normalizePhoneNumber(rawPh);

        if (!normPh) return;
        if (idStr && existingIdSet.has(String(idStr))) return;
        if (existingPhoneMap.has(normPh)) return;

        newContactsToInsert.push({
          name: r.name || 'Recipient Contact',
          phoneRaw: rawPh || normPh,
          phoneNormalized: normPh,
          marketingOptIn: r.marketingOptIn || r.optInStatus || 'OPTED_IN',
        });
      });

      const uniqueNewMap = new Map<string, any>();
      newContactsToInsert.forEach((c) => {
        if (!uniqueNewMap.has(c.phoneNormalized)) {
          uniqueNewMap.set(c.phoneNormalized, c);
        }
      });
      const uniqueNewArray = Array.from(uniqueNewMap.values());

      if (uniqueNewArray.length > 0) {
        try {
          const inserted = await Contact.insertMany(uniqueNewArray, { ordered: false });
          eligibleContacts.push(...inserted);
        } catch (err: any) {
          if (err.insertedDocs && Array.isArray(err.insertedDocs)) {
            eligibleContacts.push(...err.insertedDocs);
          }
        }
      }
    } else {
      const selectedIdsRaw = campaign.audience?.selectedContactIds || [];
      const selectedObjectIds = selectedIdsRaw
        .filter((id: any) => id && (typeof id === 'string' || typeof id === 'object'))
        .map((id: any) => (mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id));
      const contactListId = campaign.audience?.contactListId;

      if (selectedObjectIds.length > 0) {
        eligibleContacts = await Contact.find({
          _id: { $in: selectedObjectIds },
          marketingOptIn: { $ne: 'OPTED_OUT' },
        });
      } else if (contactListId) {
        const { ContactList } = require('../models/ContactList.model.js');
        const listDoc = await ContactList.findById(contactListId).lean();
        const memberIds = (listDoc?.contactIds || []).map((id: any) =>
          mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id
        );
        eligibleContacts = await Contact.find({
          _id: { $in: memberIds },
          marketingOptIn: { $ne: 'OPTED_OUT' },
        });
      } else {
        eligibleContacts = await Contact.find({ marketingOptIn: { $ne: 'OPTED_OUT' } });
      }
    }

    if (eligibleContacts.length === 0) {
      throw new ValidationError('No eligible (opted-in) recipient contacts found for this campaign.');
    }

    // 2. Single Upload Header Media if required
    let mediaId: string | undefined = undefined;
    if (campaign.headerConfig?.format && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(campaign.headerConfig.format)) {
      const assetId = campaign.headerConfig.assetId;
      if (!assetId) {
        throw new ValidationError(`Template header format ${campaign.headerConfig.format} requires a company media asset.`);
      }

      const asset = await CompanyAsset.findOne({ assetId });
      if (!asset) {
        throw new ValidationError(`Selected company asset '${assetId}' not found in MongoDB.`);
      }

      const fullPath = path.join(ASSETS_MEDIA_DIR, asset.storedFilename);
      if (!fs.existsSync(fullPath)) {
        throw new ValidationError(`The media file '${asset.originalFilename}' is missing on server storage. Please go to Company -> Media Assets, re-upload the image, and re-select it in your campaign.`);
      }
      logger.info('[CampaignEngine] Uploading media asset to Meta Cloud API once', { assetId: asset.assetId });
      mediaId = await WhatsAppService.uploadMedia(fullPath, asset.mimeType);
    }

    // 3. Create CampaignRecipient MongoDB documents in 500-item chunks
    await CampaignRecipient.deleteMany({ campaignId }); // Clear previous runs if any

    const recipientDocs = eligibleContacts.map((contact) => ({
      campaignId,
      contactId: contact._id && String(contact._id).length === 24 ? contact._id : undefined,
      phone: contact.phoneNormalized || contact.phoneRaw || contact.phone,
      variableValues: {},
      mediaAssetId: mediaId,
      status: 'QUEUED',
      attempts: 0,
    }));

    const chunkSize = 500;
    for (let i = 0; i < recipientDocs.length; i += chunkSize) {
      const chunk = recipientDocs.slice(i, i + chunkSize);
      try {
        await CampaignRecipient.insertMany(chunk, { ordered: false });
      } catch (err: any) {
        logger.warn('[CampaignEngine] Recipient insertMany partial write', { error: err.message || String(err) });
      }
    }

    // 4. Update Campaign status in MongoDB
    campaign.status = 'RUNNING';
    campaign.startedAt = new Date();
    await campaign.save();

    // 5. Trigger controlled background sending loop (non-blocking)
    CampaignSendingService.runBackgroundLoop(campaignId);

    return {
      campaignId,
      status: 'RUNNING',
      totalJobs: recipientDocs.length,
    };
  }

  public static async pauseCampaign(campaignId: string): Promise<void> {
    const campaign = await Campaign.findOne({ campaignId });
    if (!campaign) throw new NotFoundError('Campaign not found');
    campaign.status = 'PAUSED';
    await campaign.save();
    logger.info('[CampaignEngine] Campaign paused', { campaignId });
  }

  public static async resumeCampaign(campaignId: string): Promise<void> {
    const campaign = await Campaign.findOne({ campaignId });
    if (!campaign) throw new NotFoundError('Campaign not found');
    campaign.status = 'RUNNING';
    await campaign.save();

    CampaignSendingService.runBackgroundLoop(campaignId);
    logger.info('[CampaignEngine] Campaign resumed', { campaignId });
  }

  public static async cancelCampaign(campaignId: string): Promise<void> {
    const campaign = await Campaign.findOne({ campaignId });
    if (!campaign) throw new NotFoundError('Campaign not found');
    campaign.status = 'CANCELLED';
    campaign.completedAt = new Date();
    await campaign.save();

    // Mark remaining queued recipients as CANCELLED
    await CampaignRecipient.updateMany(
      { campaignId, status: { $in: ['QUEUED', 'SENDING'] } },
      { $set: { status: 'CANCELLED' } }
    );

    logger.info('[CampaignEngine] Campaign cancelled', { campaignId });
  }

  public static async getCampaignProgress(campaignId: string): Promise<CampaignProgressMetrics> {
    const campaign = await Campaign.findOne({ campaignId });
    const status: CampaignStatus = campaign ? campaign.status : 'DRAFT';

    const counts = await CampaignRecipient.aggregate([
      { $match: { campaignId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    let total = 0;
    let queued = 0;
    let sending = 0;
    let rawSent = 0;
    let rawDelivered = 0;
    let rawRead = 0;
    let failed = 0;

    counts.forEach((item) => {
      const c = item.count;
      total += c;
      if (item._id === 'QUEUED') queued = c;
      if (item._id === 'SENDING') sending = c;
      if (item._id === 'SENT') rawSent = c;
      if (item._id === 'DELIVERED') rawDelivered = c;
      if (item._id === 'READ') rawRead = c;
      if (item._id === 'FAILED') failed = c;
    });

    const read = rawRead;
    const delivered = rawDelivered + rawRead;
    const sent = rawSent + rawDelivered + rawRead;
    const processed = sent + failed;
    const percentage = total > 0 ? Math.round((processed / total) * 10000) / 100 : 0;

    return {
      total,
      queued,
      sending,
      sent,
      delivered,
      read,
      failed,
      processed,
      percentage,
      status,
    };
  }

  /**
   * Controlled Background Processing Loop
   */
  private static runBackgroundLoop(campaignId: string): void {
    if (CampaignSendingService.activeRunners.has(campaignId)) return;
    CampaignSendingService.activeRunners.add(campaignId);

    // Fire & forget background execution
    setImmediate(async () => {
      try {
        await CampaignSendingService.processCampaign(campaignId);
      } finally {
        CampaignSendingService.activeRunners.delete(campaignId);
      }
    });
  }

  private static async processCampaign(campaignId: string): Promise<void> {
    const concurrency = env.WHATSAPP_SEND_CONCURRENCY || 5;

    while (true) {
      const campaign = await Campaign.findOne({ campaignId });
      if (!campaign || campaign.status !== 'RUNNING') {
        logger.info('[CampaignEngine] Background loop stopping: state changed', { campaignId, status: campaign?.status });
        break;
      }

      // Check remaining queued recipients
      const queuedCount = await CampaignRecipient.countDocuments({ campaignId, status: 'QUEUED' });
      const sendingCount = await CampaignRecipient.countDocuments({ campaignId, status: 'SENDING' });

      if (queuedCount === 0 && sendingCount === 0) {
        campaign.status = 'COMPLETED';
        campaign.completedAt = new Date();
        await campaign.save();
        logger.info('[CampaignEngine] Campaign completed successfully', { campaignId });
        break;
      }

      // Batch claim recipients atomically (QUEUED -> SENDING)
      const workers: Promise<void>[] = [];
      for (let i = 0; i < concurrency; i++) {
        workers.push(CampaignSendingService.processNextRecipient(campaign));
      }

      await Promise.all(workers);

      // Brief delay between batches to respect Meta API limits
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  private static async processNextRecipient(campaign: ICampaign): Promise<void> {
    // Atomic claim of a queued recipient
    const recipient = await CampaignRecipient.findOneAndUpdate(
      { campaignId: campaign.campaignId, status: 'QUEUED' },
      { $set: { status: 'SENDING' }, $inc: { attempts: 1 } },
      { returnDocument: 'after' }
    ).populate('contactId');

    if (!recipient) return;

    const contact: any = recipient.contactId;

    // Resolve variables
    const bodyVariables: Record<string, string> = {};
    let variableError: string | null = null;

    (campaign.variableMappings || []).forEach((m: any) => {
      let val = '';
      if (m.mappingType === 'CONTACT_FIELD' && m.contactField) {
        const key = m.contactField;
        if (contact) {
          val = contact[key] || contact.customFields?.[key] || '';
        }
        if (!val) {
          variableError = `Missing required contact field '${key}'`;
        }
      } else if (m.mappingType === 'STATIC_TEXT') {
        val = m.staticValue || '';
      }
      bodyVariables[m.variableKey] = val;
    });

    if (variableError) {
      recipient.status = 'FAILED';
      recipient.errorCode = 'VARIABLE_RESOLUTION_ERROR';
      recipient.errorReason = variableError;
      await recipient.save();
      return;
    }

    // Send template message via Meta WhatsApp Cloud API
    try {
      const res = await WhatsAppService.sendTemplateMessage({
        recipientPhone: recipient.phone,
        templateName: campaign.templateName,
        languageCode: campaign.templateLanguage,
        bodyVariables,
        headerFormat: campaign.headerConfig?.format,
        headerMediaId: recipient.mediaAssetId,
        headerText: campaign.headerConfig?.textValue,
      });

      recipient.status = 'SENT';
      recipient.whatsappMessageId = res.messageId;
      recipient.sentAt = new Date();
      await recipient.save();
    } catch (err: any) {
      const safeErr = WhatsAppService.sanitizeError(err);
      const maxRetries = env.WHATSAPP_MAX_RETRIES || 3;
      const errCodeStr = String(err.code || err.errorCode || '');
      const is131049 =
        errCodeStr === '131049' ||
        errCodeStr === '131026' ||
        safeErr.includes('healthy ecosystem engagement');

      if (is131049) {
        recipient.status = 'FAILED';
        recipient.errorCode = '131049';
        recipient.errorReason = 'This message was not delivered to maintain healthy ecosystem engagement.';
        recipient.retryAfter = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Hours Cooldown
        await recipient.save();
        logger.warn('[CampaignEngine] Recipient marketing limited by Meta (131049)', {
          phoneSuffix: recipient.phone.slice(-4),
          retryAfter: recipient.retryAfter,
        });
      } else if (recipient.attempts < maxRetries && err.status !== 400) {
        // Reset to QUEUED for transient retry after backoff
        recipient.status = 'QUEUED';
        await recipient.save();
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, recipient.attempts) * 1000));
      } else {
        recipient.status = 'FAILED';
        recipient.errorCode = err.code || 'WHATSAPP_API_ERROR';
        recipient.errorReason = safeErr;
        await recipient.save();
      }
    }
  }

  /**
   * Manually retry failed recipients (enforcing 24h retryAfter cooldown for error 131049)
   */
  public static async retryFailedRecipients(campaignId: string): Promise<{ retriedCount: number; blockedCount: number }> {
    const failedRecipients = await CampaignRecipient.find({ campaignId, status: 'FAILED' });
    const now = new Date();

    let retriedCount = 0;
    let blockedCount = 0;

    for (const recipient of failedRecipients) {
      const is131049 =
        recipient.errorCode === '131049' ||
        recipient.errorCode === '131026' ||
        (recipient.errorReason || '').includes('healthy ecosystem engagement');

      if (is131049 || recipient.retryAfter) {
        const canRetry = recipient.retryAfter ? recipient.retryAfter.getTime() <= now.getTime() : false;
        if (!canRetry) {
          blockedCount++;
          continue;
        }
      }

      recipient.status = 'QUEUED';
      recipient.attempts = 0;
      await recipient.save();
      retriedCount++;
    }

    if (retriedCount > 0) {
      const campaign = await Campaign.findOne({ campaignId });
      if (campaign && campaign.status !== 'RUNNING') {
        campaign.status = 'RUNNING';
        await campaign.save();
        CampaignSendingService.runBackgroundLoop(campaignId);
      }
    }

    return { retriedCount, blockedCount };
  }
}
