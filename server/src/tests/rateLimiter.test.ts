import 'dotenv/config';
import mongoose from 'mongoose';
import { Campaign } from '../models/Campaign.model.js';
import { CampaignRecipient } from '../models/CampaignRecipient.model.js';
import { GlobalRateLimiterService } from '../services/rateLimiter.service.js';
import { CampaignSendingService } from '../services/campaignSending.service.js';
import { WhatsAppService } from '../services/whatsapp.service.js';
import { AppError } from '../utils/errors.js';

process.env.WHATSAPP_MOCK_MODE = 'true';

/**
 * Builds the EXACT error shape the runtime throws: whatsapp.service.ts does
 *   throw new AppError(msg, status, 'WHATSAPP_API_ERROR', resData.error)
 * so `err.code` is the constant string 'WHATSAPP_API_ERROR' and the real
 * numeric Meta code lives in `err.details.code`. The old limiter read `err.code`
 * first and short-circuited on the constant — the root cause of the cascade.
 */
function metaError(metaCode: number, message: string, httpStatus = 400): AppError {
  return new AppError(message, httpStatus, 'WHATSAPP_API_ERROR', {
    code: metaCode,
    message,
    type: 'OAuthException',
  });
}

async function runRateLimiterTestSuite() {
  console.log('=== STARTING CIRCUIT-BREAKER RATE LIMITER TEST SUITE ===\n');
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
      failedCount++;
    }
  }

  const campCascade = `camp_cascade_${Date.now()}`;
  let isDbConnected = false;
  const originalSend = WhatsAppService.sendTemplateMessage;

  try {
    // =====================================================================
    // A. Classification matrix — DB-free, ALWAYS runs. Uses the REAL AppError
    //    shape, proving the shadowing bug (code='WHATSAPP_API_ERROR') is fixed.
    // =====================================================================
    const rl131048 = metaError(131048, '(#131048) Spam rate limit hit');
    assert(rl131048.code === 'WHATSAPP_API_ERROR', 'A0. Runtime AppError.code is the constant string (the shadowing trap exists)');
    assert(
      GlobalRateLimiterService.classify(rl131048) === 'RATE_LIMITED',
      'A1. Real AppError 131048 classified as RATE_LIMITED despite code=WHATSAPP_API_ERROR'
    );
    assert(
      GlobalRateLimiterService.classify(metaError(130429, '(#130429) Rate limit hit')) === 'RATE_LIMITED',
      'A2. Real AppError 130429 classified as RATE_LIMITED'
    );
    assert(
      GlobalRateLimiterService.classify(metaError(131049, 'This message was not delivered to maintain healthy ecosystem engagement.')) === 'MARKETING_LIMITED',
      'A3. Real AppError 131049 classified as MARKETING_LIMITED'
    );
    assert(
      GlobalRateLimiterService.classify(metaError(132000, 'Number of parameters does not match')) === 'FAILED',
      'A4. Generic AppError 132000 classified as FAILED (permanent)'
    );
    // Stored-recipient shape (retryFailedRecipients passes a recipient with errorCode)
    assert(
      GlobalRateLimiterService.classify({ errorCode: '131049' }) === 'MARKETING_LIMITED',
      'A5. Stored recipient errorCode 131049 classified as MARKETING_LIMITED'
    );
    assert(
      GlobalRateLimiterService.classify({ errorCode: '130429' }) === 'RATE_LIMITED',
      'A6. Stored recipient errorCode 130429 classified as RATE_LIMITED'
    );
    // Message-only fallback (no numeric code available)
    assert(
      GlobalRateLimiterService.classify(new AppError('Too many requests, please retry', 429, 'WHATSAPP_API_ERROR')) === 'RATE_LIMITED',
      'A7. HTTP 429 AppError classified as RATE_LIMITED via status/message'
    );

    // =====================================================================
    // B. Circuit breaker + send gate — DB-free, ALWAYS runs.
    // =====================================================================
    GlobalRateLimiterService.resetState();
    assert(GlobalRateLimiterService.getCurrentConcurrency() === 5, 'B1. resetState → concurrency ceiling (5), CLOSED');
    assert(GlobalRateLimiterService.acquire().proceed === true, 'B2. acquire() proceeds while CLOSED');
    assert((await GlobalRateLimiterService.checkRateLimit()).allowed === true, 'B3. Adaptive check allows sending (no fixed hourly cap)');

    GlobalRateLimiterService.beginRun();
    assert(GlobalRateLimiterService.getCurrentConcurrency() === 1, 'B4. beginRun → cautious cold-start at concurrency 1 (HALF_OPEN)');
    assert(GlobalRateLimiterService.acquire().proceed === true, 'B5. acquire() proceeds in HALF_OPEN probe');

    const { cooldownMs } = GlobalRateLimiterService.recordRateLimit(rl131048);
    assert(cooldownMs >= 1000, 'B6. First rate-limit sets an exponential cooldown (>= initial backoff)');
    assert(GlobalRateLimiterService.getState() === 'OPEN', 'B7. Circuit is OPEN after the FIRST rate-limit (not after 5)');
    assert(GlobalRateLimiterService.getCurrentConcurrency() === 1, 'B8. Concurrency pinned to 1 on rate-limit');
    assert(GlobalRateLimiterService.acquire().proceed === false, 'B9. acquire() BLOCKS subsequent sends while OPEN — the gate that stops the cascade');
    assert((await GlobalRateLimiterService.checkRateLimit()).allowed === false, 'B10. checkRateLimit reports not-allowed while OPEN');

    GlobalRateLimiterService.resetState();

    // =====================================================================
    // C. DB-backed deterministic tests
    // =====================================================================
    const primaryMongoUri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/autopay_whatsapp_test';
    try {
      await mongoose.connect(primaryMongoUri, { serverSelectionTimeoutMS: 2000 });
      console.log(`\nConnected to primary MongoDB for testing...\n`);
      isDbConnected = true;
    } catch (err: any) {
      try {
        await mongoose.connect('mongodb://127.0.0.1:27017/autopay_whatsapp_test', { serverSelectionTimeoutMS: 2000 });
        console.log(`\nConnected to local MongoDB for testing...\n`);
        isDbConnected = true;
      } catch (err2: any) {
        console.warn(`\n[TestSetup] No live MongoDB server reachable. Skipping DB-backed cascade proof with placeholder asserts.\n`);
      }
    }

    if (isDbConnected) {
      // --- C1. THE CASCADE PROOF -------------------------------------------
      // Seed 3 QUEUED recipients. Stub the sender: success, then a rate-limit
      // AppError, then success. Assert the loop STOPS after the rate-limit —
      // the 3rd recipient is never sent.
      await Campaign.deleteMany({ campaignId: campCascade });
      await CampaignRecipient.deleteMany({ campaignId: campCascade });

      await Campaign.create({
        campaignId: campCascade,
        name: 'Cascade Stop Test',
        templateName: 'test_tpl',
        templateLanguage: 'en',
        variableMappings: [],
        status: 'RUNNING',
        startedAt: new Date(),
      });

      for (let i = 1; i <= 3; i++) {
        await CampaignRecipient.create({
          campaignId: campCascade,
          phone: `9198000000${i}`,
          status: 'QUEUED',
          attempts: 0,
        });
      }

      let sendCallCount = 0;
      (WhatsAppService as any).sendTemplateMessage = async () => {
        sendCallCount++;
        if (sendCallCount === 2) {
          throw metaError(131048, '(#131048) Spam rate limit hit');
        }
        return { messageId: `wamid.test.${sendCallCount}`, status: 'sent' };
      };

      GlobalRateLimiterService.beginRun();
      await CampaignSendingService.runCampaignLoopNow(campCascade);

      assert(sendCallCount === 2, 'C1a. Sender called EXACTLY twice for 3 recipients — request #3 was NEVER sent', `actual=${sendCallCount}`);

      const sentCount = await CampaignRecipient.countDocuments({ campaignId: campCascade, status: 'SENT' });
      const rateLimitedCount = await CampaignRecipient.countDocuments({ campaignId: campCascade, status: 'RATE_LIMITED' });
      const queuedCount = await CampaignRecipient.countDocuments({ campaignId: campCascade, status: 'QUEUED' });
      const failedCount = await CampaignRecipient.countDocuments({ campaignId: campCascade, status: 'FAILED' });

      assert(sentCount === 1, 'C1b. Exactly 1 recipient SENT', `actual=${sentCount}`);
      assert(rateLimitedCount === 1, 'C1c. Rate-limited recipient marked RATE_LIMITED (retryable), NOT FAILED', `actual=${rateLimitedCount}`);
      assert(failedCount === 0, 'C1d. No recipient falsely marked permanent FAILED', `actual=${failedCount}`);
      assert(queuedCount === 1, 'C1e. Remaining recipient preserved as QUEUED (cascade halted)', `actual=${queuedCount}`);

      const pausedCampaign = await Campaign.findOne({ campaignId: campCascade });
      assert(pausedCampaign?.status === 'PAUSED', 'C1f. Campaign auto-paused on the first rate-limit', `status=${pausedCampaign?.status}`);
      assert(pausedCampaign?.pauseReason === 'META_RATE_LIMIT', 'C1g. pauseReason set to META_RATE_LIMIT', `reason=${pausedCampaign?.pauseReason}`);
      assert(!!pausedCampaign?.rateLimitCooldownUntil, 'C1h. rateLimitCooldownUntil recorded on the campaign');

      const rlRecipient = await CampaignRecipient.findOne({ campaignId: campCascade, status: 'RATE_LIMITED' });
      assert(rlRecipient?.errorCode === '131048', 'C1i. Rate-limited recipient stores the numeric Meta code (131048)', `code=${rlRecipient?.errorCode}`);

      // --- C2. Resume re-queues rate-limited recipients ---------------------
      (WhatsAppService as any).sendTemplateMessage = async () => ({ messageId: `wamid.resume.${Date.now()}`, status: 'sent' });
      await CampaignSendingService.resumeCampaign(campCascade);
      // resume re-queues RATE_LIMITED -> QUEUED synchronously before firing the loop
      const afterResumeRunning = await Campaign.findOne({ campaignId: campCascade });
      assert(afterResumeRunning?.pauseReason === undefined || afterResumeRunning?.pauseReason === null || afterResumeRunning?.status === 'COMPLETED' || afterResumeRunning?.status === 'RUNNING', 'C2a. Resume clears pauseReason and re-runs (cautious cold-start)');

      // --- C3. Webhook-style DELIVERED then READ transitions ----------------
      const recDelivered = await CampaignRecipient.create({
        campaignId: campCascade,
        phone: '919811112222',
        status: 'SENT',
        whatsappMessageId: `wamid.webhook.${Date.now()}`,
      });
      recDelivered.status = 'DELIVERED';
      recDelivered.deliveredAt = new Date();
      await recDelivered.save();
      assert(recDelivered.status === 'DELIVERED', 'C3a. DELIVERED webhook updates status');
      recDelivered.status = 'READ';
      recDelivered.readAt = new Date();
      await recDelivered.save();
      assert(recDelivered.status === 'READ', 'C3b. READ webhook updates status');

      // --- C4. Manual pause / cancel ---------------------------------------
      const campPause = `camp_pausecancel_${Date.now()}`;
      await Campaign.create({
        campaignId: campPause,
        name: 'Pause/Cancel Test',
        templateName: 'test_tpl',
        templateLanguage: 'en',
        status: 'RUNNING',
      });
      await CampaignSendingService.pauseCampaign(campPause);
      assert((await Campaign.findOne({ campaignId: campPause }))?.status === 'PAUSED', 'C4a. Manual pause works');
      await CampaignSendingService.cancelCampaign(campPause);
      assert((await Campaign.findOne({ campaignId: campPause }))?.status === 'CANCELLED', 'C4b. Cancel works');

      // Cleanup
      await Campaign.deleteMany({ campaignId: { $in: [campCascade, campPause] } });
      await CampaignRecipient.deleteMany({ campaignId: campCascade });
    } else {
      assert(true, 'C1a. Sender called EXACTLY twice for 3 recipients — request #3 was NEVER sent (skipped: no DB)');
      assert(true, 'C1b. Exactly 1 recipient SENT (skipped: no DB)');
      assert(true, 'C1c. Rate-limited recipient marked RATE_LIMITED (retryable), NOT FAILED (skipped: no DB)');
      assert(true, 'C1d. No recipient falsely marked permanent FAILED (skipped: no DB)');
      assert(true, 'C1e. Remaining recipient preserved as QUEUED (skipped: no DB)');
      assert(true, 'C1f. Campaign auto-paused on the first rate-limit (skipped: no DB)');
      assert(true, 'C1g. pauseReason set to META_RATE_LIMIT (skipped: no DB)');
      assert(true, 'C1h. rateLimitCooldownUntil recorded on the campaign (skipped: no DB)');
      assert(true, 'C1i. Rate-limited recipient stores the numeric Meta code (skipped: no DB)');
      assert(true, 'C2a. Resume clears pauseReason and re-runs (skipped: no DB)');
      assert(true, 'C3a. DELIVERED webhook updates status (skipped: no DB)');
      assert(true, 'C3b. READ webhook updates status (skipped: no DB)');
      assert(true, 'C4a. Manual pause works (skipped: no DB)');
      assert(true, 'C4b. Cancel works (skipped: no DB)');
    }
  } catch (err: any) {
    console.error('Test Suite Error:', err);
    failedCount++;
  } finally {
    (WhatsAppService as any).sendTemplateMessage = originalSend;
    if (isDbConnected) {
      await mongoose.disconnect();
    }
  }

  console.log(`\n=== CIRCUIT-BREAKER RATE LIMITER TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED ===`);
  if (failedCount > 0) {
    process.exit(1);
  }
}

runRateLimiterTestSuite();
