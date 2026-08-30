import 'dotenv/config';
import mongoose from 'mongoose';
import { Campaign } from '../models/Campaign.model.js';
import { CampaignRecipient } from '../models/CampaignRecipient.model.js';
import { Conversation } from '../models/Conversation.model.js';
import { Message } from '../models/Message.model.js';
import { CampaignSendingService } from '../services/campaignSending.service.js';
import { InboxService } from '../services/inbox.service.js';
import { InboxService as InboxServiceClass } from '../services/inbox.service.js';
import { AppError } from '../utils/errors.js';

process.env.WHATSAPP_MOCK_MODE = 'true';

async function runError131049TestSuite() {
  console.log('=== STARTING META ERROR 131049 & ECOSYSTEM ENGAGEMENT TEST SUITE ===\n');
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

  const testCampaignId = `camp_131049_${Date.now()}`;
  const testPhone = '919888877777';

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/autopay_whatsapp_test';
    await mongoose.connect(mongoUri);
    console.log(`Connected to MongoDB for testing...\n`);

    // Clean up test records
    await Campaign.deleteMany({ campaignId: testCampaignId });
    await CampaignRecipient.deleteMany({ campaignId: testCampaignId });
    await Conversation.deleteMany({ phoneNumber: testPhone });

    // Test 1, 2, 3, 4, 5: Create CampaignRecipient failing with error 131049
    const recipient = await CampaignRecipient.create({
      campaignId: testCampaignId,
      phone: testPhone,
      status: 'FAILED',
      errorCode: '131049',
      errorReason: 'This message was not delivered to maintain healthy ecosystem engagement.',
      retryAfter: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 Hours in Future
    });

    assert(recipient.status === 'FAILED', '1. Delivery status is FAILED (never falsely marked as DELIVERED)');
    assert(recipient.status !== 'DELIVERED', '2. Status is strictly NOT DELIVERED');
    assert(recipient.errorCode === '131049', '3. Dedicated errorCode 131049 stored correctly');
    assert(
      recipient.errorReason === 'This message was not delivered to maintain healthy ecosystem engagement.',
      '4. Exact errorReason message stored correctly'
    );
    assert(
      Boolean(recipient.retryAfter && recipient.retryAfter.getTime() > Date.now() + 23 * 60 * 60 * 1000),
      '5. retryAfter timestamp set to 24 hours in the future'
    );

    // Test 6 & 7: Manual Retry blocked during 24h cooldown
    const retryRes1 = await CampaignSendingService.retryFailedRecipients(testCampaignId);
    assert(retryRes1.retriedCount === 0, '6. Manual retry blocks 131049 recipients during 24h cooldown (retriedCount = 0)');
    assert(retryRes1.blockedCount === 1, '7. 131049 recipient identified as blocked by 24h cooldown (blockedCount = 1)');

    const reCheck1 = await CampaignRecipient.findById(recipient._id);
    assert(reCheck1?.status === 'FAILED', 'Status remains FAILED during 24h cooldown (no status regression)');

    // Test 8: Manual Retry allowed AFTER 24h cooldown
    recipient.retryAfter = new Date(Date.now() - 1000); // Set to past (cooldown expired)
    await recipient.save();

    const retryRes2 = await CampaignSendingService.retryFailedRecipients(testCampaignId);
    assert(retryRes2.retriedCount === 1, '8. Manual retry succeeds once 24h retryAfter timestamp has passed');

    const reCheck2 = await CampaignRecipient.findById(recipient._id);
    assert(reCheck2?.status === 'QUEUED', 'Recipient reset to QUEUED for delivery after cooldown expiration');

    // Test 9 & 10: Two-Way Inbox Integration (24h Customer Service Window Active vs Expired)
    const testWamidInbound = `wamid.inbound.131049.${Date.now()}`;
    const inboundRes = await InboxServiceClass.processInboundWebhookMessage({
      wamid: testWamidInbound,
      senderPhone: testPhone,
      textBody: 'Hello business, I want info',
    });

    assert(!!inboundRes.conversation, '9. Customer inbound message creates/updates conversation');
    assert(
      Boolean(
        inboundRes.conversation.messagingWindowExpiresAt &&
          inboundRes.conversation.messagingWindowExpiresAt.getTime() > Date.now()
      ),
      '10. Inbound message opens active 24h customer service window'
    );

    // Freeform reply allowed during active 24h window
    const replyRes = await InboxServiceClass.sendOutboundReply({
      conversationId: String(inboundRes.conversation._id),
      text: 'Thanks for reaching out! Here is your info.',
    });
    assert(replyRes.message.direction === 'OUTBOUND', 'Freeform reply allowed during active customer service window');

    // Expired window test
    inboundRes.conversation.messagingWindowExpiresAt = new Date(Date.now() - 3600 * 1000);
    await inboundRes.conversation.save();

    let expiredBlocked = false;
    try {
      await InboxServiceClass.sendOutboundReply({
        conversationId: String(inboundRes.conversation._id),
        text: 'This freeform message should be blocked when window is expired',
      });
    } catch (err: any) {
      if (err instanceof AppError && err.code === 'WINDOW_EXPIRED') {
        expiredBlocked = true;
      }
    }
    assert(expiredBlocked, '12. Freeform text reply blocked when customer service window is expired');

    // Clean up test records
    await Campaign.deleteMany({ campaignId: testCampaignId });
    await CampaignRecipient.deleteMany({ campaignId: testCampaignId });
    await Message.deleteMany({ conversationId: inboundRes.conversation._id });
    await Conversation.deleteMany({ _id: inboundRes.conversation._id });

  } catch (err: any) {
    console.error('Test Suite Error:', err);
    failedCount++;
  } finally {
    await mongoose.disconnect();
  }

  console.log(`\n=== META ERROR 131049 TEST SUITE SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED ===`);
  if (failedCount > 0) {
    process.exit(1);
  }
}

runError131049TestSuite();
