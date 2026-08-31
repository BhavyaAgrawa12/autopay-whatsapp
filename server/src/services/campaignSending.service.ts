import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { Campaign, ICampaign, CampaignStatus } from '../models/Campaign.model.js';
import { CampaignRecipient } from '../models/CampaignRecipient.model.js';
import { Contact } from '../models/Contact.model.js';
import { CompanyAsset } from '../models/CompanyAsset.model.js';
import { WhatsAppService } from './whatsapp.service.js';
import { GlobalRateLimiterService } from './rateLimiter.service.js';
import { ASSETS_MEDIA_DIR } from '../utils/fileStorage.js';
import { normalizePhoneNumber } from '../utils/phone.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface CampaignProgressMetrics {
  total: number;
  queued: number;
  sending: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  marketingLimited: number;
  rateLimited: number;
  processed: number;
  percentage: number;
  status: CampaignStatus;
  sendingRate: string;
  pauseReason?: string;
  rateLimitCooldownUntil?: Date;
}

/**
 * Outcome of attempting to send to one recipient. The loop uses this to decide
 * whether to stop the whole run (RATE_LIMITED) without spawning a new batch.
 */
type RecipientResult = 'SENT' | 'FAILED' | 'MARKETING_LIMITED' | 'RATE_LIMITED' | 'BLOCKED' | 'NONE';


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

    // 4. Cautious cold-start of the circuit breaker & update Campaign status.
    //    beginRun() starts at concurrency 1 (HALF_OPEN) and ramps up only after
    //    sustained success — never assume a safe throughput up front.
    GlobalRateLimiterService.beginRun();
    campaign.status = 'RUNNING';
    campaign.startedAt = new Date();
    campaign.pauseReason = undefined;
    campaign.rateLimitCooldownUntil = undefined;
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

    // Rate-limited recipients were preserved as retryable (not permanently
    // FAILED). On an explicit admin resume, put them back in the queue so they
    // get another chance under the cautious cold-start.
    const requeued = await CampaignRecipient.updateMany(
      { campaignId, status: 'RATE_LIMITED' },
      { $set: { status: 'QUEUED' }, $unset: { errorCode: '', errorReason: '' } }
    );

    campaign.status = 'RUNNING';
    campaign.pauseReason = undefined;
    campaign.rateLimitCooldownUntil = undefined;
    await campaign.save();

    // Cautious cold-start: resume at concurrency 1 and ramp only on sustained
    // success. If Meta is still limiting, the very first send will pause again.
    GlobalRateLimiterService.beginRun();
    CampaignSendingService.runBackgroundLoop(campaignId);
    logger.info('[CampaignEngine] Campaign resumed (cautious cold-start)', {
      campaignId,
      requeuedRateLimited: requeued.modifiedCount,
    });
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
    let marketingLimited = 0;
    let rateLimited = 0;

    counts.forEach((item) => {
      const c = item.count;
      total += c;
      if (item._id === 'QUEUED') queued = c;
      if (item._id === 'SENDING') sending = c;
      if (item._id === 'SENT') rawSent = c;
      if (item._id === 'DELIVERED') rawDelivered = c;
      if (item._id === 'READ') rawRead = c;
      if (item._id === 'FAILED') failed = c;
      if (item._id === 'MARKETING_LIMITED') marketingLimited = c;
      if (item._id === 'RATE_LIMITED') rateLimited = c;
    });

    const read = rawRead;
    const delivered = rawDelivered + rawRead;
    const sent = rawSent + rawDelivered + rawRead;
    const processed = sent + failed + marketingLimited + rateLimited;
    const percentage = total > 0 ? Math.round((processed / total) * 10000) / 100 : 0;
    const activeConcurrency = GlobalRateLimiterService.getCurrentConcurrency();

    const isRateLimitPause = status === 'PAUSED' && campaign?.pauseReason === 'META_RATE_LIMIT';
    const sendingRate = isRateLimitPause
      ? 'Paused — Meta rate limit cooldown'
      : `Adaptive (${activeConcurrency} concurrent worker${activeConcurrency > 1 ? 's' : ''})`;

    return {
      total,
      queued,
      sending,
      sent,
      delivered,
      read,
      failed,
      marketingLimited,
      rateLimited,
      processed,
      percentage,
      status,
      sendingRate,
      pauseReason: campaign?.pauseReason,
      rateLimitCooldownUntil: campaign?.rateLimitCooldownUntil,
    };
  }

  /**
   * Awaitable single-run entry point. Used by tests to deterministically drive
   * the loop to completion (or to a rate-limit pause) and assert on the result.
   */
  public static async runCampaignLoopNow(campaignId: string): Promise<void> {
    await CampaignSendingService.processCampaign(campaignId);
  }

  /**
   * Controlled background processing loop wrapper (fire-and-forget).
   */
  private static runBackgroundLoop(campaignId: string): void {
    if (CampaignSendingService.activeRunners.has(campaignId)) return;
    CampaignSendingService.activeRunners.add(campaignId);

    setImmediate(async () => {
      try {
        await CampaignSendingService.processCampaign(campaignId);
      } catch (err: any) {
        logger.error('[CampaignEngine] Background loop crashed', { campaignId, error: err?.message });
      } finally {
        CampaignSendingService.activeRunners.delete(campaignId);
      }
    });
  }

  private static async processCampaign(campaignId: string): Promise<void> {
    while (true) {
      const campaign = await Campaign.findOne({ campaignId });
      if (!campaign || campaign.status !== 'RUNNING') {
        logger.info('[CampaignEngine] Loop stopping: campaign no longer RUNNING', {
          campaignId,
          status: campaign?.status,
        });
        break;
      }

      // Defensive: if the breaker is OPEN (active cooldown), stop spawning work.
      // The worker that tripped it has already set the campaign to PAUSED; it
      // resumes only on explicit admin action (manual resume).
      if (GlobalRateLimiterService.isOpen()) {
        logger.warn('[CampaignEngine] Circuit OPEN — halting loop until manual resume', { campaignId });
        break;
      }

      const queuedCount = await CampaignRecipient.countDocuments({ campaignId, status: 'QUEUED' });
      const sendingCount = await CampaignRecipient.countDocuments({ campaignId, status: 'SENDING' });

      if (queuedCount === 0 && sendingCount === 0) {
        campaign.status = 'COMPLETED';
        campaign.completedAt = new Date();
        await campaign.save();
        logger.info('[CampaignEngine] Campaign completed successfully', { campaignId });
        break;
      }

      // Batch size follows the breaker's current concurrency (cautious 1 at
      // cold-start, ramping up only after sustained success).
      const concurrency = Math.max(1, GlobalRateLimiterService.getCurrentConcurrency());
      const workers: Promise<RecipientResult>[] = [];
      for (let i = 0; i < concurrency; i++) {
        workers.push(CampaignSendingService.processNextRecipient(campaign));
      }
      const results = await Promise.all(workers);

      // If ANY send in this batch hit a Meta rate limit, the breaker is now OPEN
      // and the campaign is PAUSED. Stop immediately — do NOT spawn a new batch.
      // This is what stops the cascade after the very first rate-limit response.
      if (results.includes('RATE_LIMITED') || GlobalRateLimiterService.isOpen()) {
        logger.warn('[CampaignEngine] Rate limit detected — campaign paused, loop halted', { campaignId });
        break;
      }

      // If nothing was claimable this pass (all blocked/none), back off a touch
      // to avoid a hot spin; otherwise a short yield between batches.
      const idle = results.every((r) => r === 'BLOCKED' || r === 'NONE');
      await new Promise((resolve) => setTimeout(resolve, idle ? 50 : 20));
    }
  }

  private static async processNextRecipient(campaign: ICampaign): Promise<RecipientResult> {
    // Gate BEFORE claiming — if the breaker is OPEN, don't touch a recipient
    // (leave it QUEUED for a later resume, never stranded in SENDING).
    if (!GlobalRateLimiterService.acquire().proceed) {
      return 'BLOCKED';
    }

    // Atomic claim of a queued recipient
    const recipient = await CampaignRecipient.findOneAndUpdate(
      { campaignId: campaign.campaignId, status: 'QUEUED' },
      { $set: { status: 'SENDING' }, $inc: { attempts: 1 } },
      { returnDocument: 'after' }
    ).populate('contactId');

    if (!recipient) return 'NONE';

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
      return 'FAILED';
    }

    // Re-check the gate immediately before the network call — a sibling in this
    // same batch may have just tripped the breaker. If so, roll back the claim
    // so this recipient stays eligible (QUEUED) and is never lost.
    if (!GlobalRateLimiterService.acquire().proceed) {
      recipient.status = 'QUEUED';
      recipient.attempts = Math.max(0, recipient.attempts - 1);
      await recipient.save();
      return 'BLOCKED';
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

      GlobalRateLimiterService.recordSuccess();
      return 'SENT';
    } catch (err: any) {
      const classification = GlobalRateLimiterService.classify(err);
      const safeErr = WhatsAppService.sanitizeError(err);
      const metaCode = GlobalRateLimiterService.extractMetaCode(err);

      if (classification === 'MARKETING_LIMITED') {
        // Per-recipient marketing cap (131049). NOT a global rate limit:
        // preserve as retryable after 24h, but do NOT pause the campaign and do
        // NOT count as delivered.
        recipient.status = 'MARKETING_LIMITED';
        recipient.errorCode = '131049';
        recipient.errorReason = 'This message was not delivered to maintain healthy ecosystem engagement.';
        recipient.retryAfter = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await recipient.save();
        logger.warn('[CampaignEngine] Recipient MARKETING_LIMITED (131049)', {
          classifiedAs: 'MARKETING_LIMITED',
          retryable: false,
          errorCode: '131049',
        });
        return 'MARKETING_LIMITED';
      }

      if (classification === 'RATE_LIMITED') {
        // Trip the breaker on the FIRST hit and pause the whole campaign.
        const { cooldownMs } = GlobalRateLimiterService.recordRateLimit(err);

        // Preserve this recipient as retryable — NOT permanent FAILED, and NO
        // re-queue churn while Meta is actively limiting.
        recipient.status = 'RATE_LIMITED';
        recipient.errorCode = metaCode || 'RATE_LIMITED';
        recipient.errorReason = safeErr || 'Not delivered — Meta rate/spam limit reached';
        await recipient.save();

        // Atomically pause the campaign (avoids racing sibling doc saves).
        await Campaign.updateOne(
          { campaignId: campaign.campaignId, status: 'RUNNING' },
          {
            $set: {
              status: 'PAUSED',
              pauseReason: 'META_RATE_LIMIT',
              rateLimitCooldownUntil: new Date(Date.now() + cooldownMs),
            },
          }
        );
        campaign.status = 'PAUSED';

        logger.warn('[CampaignEngine] Meta rate limit detected. Campaign temporarily paused.', {
          campaignId: campaign.campaignId,
          classifiedAs: 'RATE_LIMITED',
          retryable: true,
          httpStatus: err?.statusCode ?? err?.status,
          errorCode: metaCode || undefined,
          cooldownMs,
        });
        return 'RATE_LIMITED';
      }

      // Permanent, non-retryable failure.
      recipient.status = 'FAILED';
      recipient.errorCode = metaCode || 'WHATSAPP_API_ERROR';
      recipient.errorReason = safeErr;
      await recipient.save();
      return 'FAILED';
    }
  }

  /**
   * Manually retry failed recipients (enforcing 24h retryAfter cooldown for error 131049)
   */
  public static async retryFailedRecipients(campaignId: string): Promise<{ retriedCount: number; blockedCount: number }> {
    const failedRecipients = await CampaignRecipient.find({
      campaignId,
      status: { $in: ['FAILED', 'RATE_LIMITED', 'MARKETING_LIMITED'] },
    });
    const now = new Date();

    let retriedCount = 0;
    let blockedCount = 0;

    for (const recipient of failedRecipients) {
      const is131049 = GlobalRateLimiterService.isMarketingLimitError(recipient);

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
        campaign.pauseReason = undefined;
        campaign.rateLimitCooldownUntil = undefined;
        await campaign.save();
        GlobalRateLimiterService.beginRun();
        CampaignSendingService.runBackgroundLoop(campaignId);
      }
    }

    return { retriedCount, blockedCount };
  }
}
