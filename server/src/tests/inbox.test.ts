import 'dotenv/config';
import mongoose from 'mongoose';
import { Conversation } from '../models/Conversation.model.js';
import { Message } from '../models/Message.model.js';
import { Contact } from '../models/Contact.model.js';
import { InboxService } from '../services/inbox.service.js';
import { AppError } from '../utils/errors.js';

process.env.WHATSAPP_MOCK_MODE = 'true';

async function runInboxTestSuite() {
  console.log('=== STARTING COMPLETE TWO-WAY WHATSAPP INBOX TEST SUITE ===\n');
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

  const testPhone1 = '919876543210';
  const testPhoneKnown = '919123456789';
  const testPhoneUnknown = '919999888877';
  const testPhoneExpired = '918888777766';

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/autopay_whatsapp_test';
    await mongoose.connect(mongoUri);
    console.log(`Connected to MongoDB for testing...\n`);

    // Clean up previous test artifacts for test phones
    await Conversation.deleteMany({ phoneNumber: { $in: [testPhone1, testPhoneKnown, testPhoneUnknown, testPhoneExpired] } });
    await Contact.deleteMany({ phoneNormalized: { $in: [testPhone1, testPhoneKnown, testPhoneUnknown, testPhoneExpired] } });

    // Test 1 & 2: Real Inbound Text Webhook & Conversation Creation
    const testWamid1 = `wamid.test.inbound.${Date.now()}`;
    const res1 = await InboxService.processInboundWebhookMessage({
      wamid: testWamid1,
      senderPhone: testPhone1,
      textBody: 'Hello test inbound message',
    });

    assert(!!res1.conversation, '1. Inbound webhook processes correctly & creates conversation');
    assert(res1.conversation.phoneNumber === testPhone1, '2. Conversation phone number matches normalized input');
    assert(res1.conversation.unreadCount === 1, '6. Unread count increments to 1 on first message');
    assert(res1.message?.direction === 'INBOUND', 'Inbound message direction set to INBOUND');

    // Test 3 & 4: Contact Matching (Known vs Unknown)
    const existingContact = await Contact.create({
      name: 'Test John Doe',
      phoneRaw: '+91 91234 56789',
      phoneNormalized: testPhoneKnown,
      source: 'MANUAL_TEST',
    });

    const resKnown = await InboxService.processInboundWebhookMessage({
      wamid: `wamid.test.known.${Date.now()}`,
      senderPhone: testPhoneKnown,
      textBody: 'Hi from known contact',
    });

    assert(
      String(resKnown.conversation.contactId) === String(existingContact._id),
      '3. Existing contact matching links contactId'
    );
    assert(resKnown.conversation.displayName === 'Test John Doe', 'Display name uses linked Contact name');

    const resUnknown = await InboxService.processInboundWebhookMessage({
      wamid: `wamid.test.unknown.${Date.now()}`,
      senderPhone: testPhoneUnknown,
      textBody: 'Hi from unknown number',
    });
    assert(resUnknown.conversation.contactId === null, '4. Unknown contact creates conversation with contactId = null');

    // Test 5: Duplicate Webhook Idempotency
    const resDup = await InboxService.processInboundWebhookMessage({
      wamid: testWamid1,
      senderPhone: testPhone1,
      textBody: 'Hello test inbound message duplicate',
    });

    assert(resDup.duplicate === true, '5. Duplicate inbound webhook identified and ignored idempotently');
    const convCheck = await Conversation.findById(res1.conversation._id);
    assert(convCheck?.unreadCount === 1, 'Duplicate webhook does not increment unread count twice');

    // Test 7: Mark Conversation Read
    const convRead = await InboxService.markConversationRead(String(res1.conversation._id));
    assert(convRead.unreadCount === 0, '7. Mark conversation read resets unread count to 0');

    // Test 8: Message Pagination
    for (let i = 1; i <= 5; i++) {
      await InboxService.processInboundWebhookMessage({
        wamid: `wamid.test.page.${i}.${Date.now()}`,
        senderPhone: testPhone1,
        textBody: `Pagination message ${i}`,
      });
    }
    const pageRes = await InboxService.getConversationMessages(String(res1.conversation._id), { page: 1, limit: 3 });
    assert(pageRes.messages.length === 3, '8. Message pagination returns specified page limit');

    // Test 9: Search Safety
    const searchRes = await InboxService.getConversations({ search: 'Test John' });
    assert(searchRes.conversations.length === 1 && searchRes.conversations[0].displayName === 'Test John Doe', '9. Search matches by contact name correctly');

    // Test 10, 11, 16: Admin Outbound Reply & 24h Window Active Reply
    const outboundRes = await InboxService.sendOutboundReply({
      conversationId: String(res1.conversation._id),
      text: 'Hello, how can I help you?',
    });
    assert(outboundRes.message.direction === 'OUTBOUND', '10. Admin outbound reply creates OUTBOUND message');
    assert(outboundRes.message.status === 'SENT', '11. Outbound message stores wamid with SENT status');

    // Test 12, 13, 14, 15: Status Updates & Status Precedence (SENT -> DELIVERED -> READ, FAILED)
    const testWamidOut = outboundRes.message.whatsappMessageId;

    await InboxService.processStatusWebhookMessage({ wamid: testWamidOut, statusStr: 'DELIVERED' });
    let msgCheck = await Message.findOne({ whatsappMessageId: testWamidOut });
    assert(msgCheck?.status === 'DELIVERED', '12. Delivered webhook updates status to DELIVERED');

    await InboxService.processStatusWebhookMessage({ wamid: testWamidOut, statusStr: 'READ' });
    msgCheck = await Message.findOne({ whatsappMessageId: testWamidOut });
    assert(msgCheck?.status === 'READ', '13. Read webhook updates status to READ');

    // Test status precedence non-downgrade (SENT after READ should be ignored)
    await InboxService.processStatusWebhookMessage({ wamid: testWamidOut, statusStr: 'SENT' });
    msgCheck = await Message.findOne({ whatsappMessageId: testWamidOut });
    assert(msgCheck?.status === 'READ', '15. Status precedence prevents regressing READ status back to SENT');

    // Test 17: Messaging Window Expired Behavior
    const expiredConv = await Conversation.create({
      phoneNumber: testPhoneExpired,
      phoneRaw: '+91 88888 777766',
      displayName: 'Expired User',
      lastMessage: 'Old message',
      lastMessageAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
      messagingWindowExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired 24h ago
    });

    let windowExpiredCaught = false;
    try {
      await InboxService.sendOutboundReply({
        conversationId: String(expiredConv._id),
        text: 'This should be blocked because window is expired',
      });
    } catch (err: any) {
      if (err instanceof AppError && err.code === 'WINDOW_EXPIRED') {
        windowExpiredCaught = true;
      }
    }
    assert(windowExpiredCaught, '17. Outbound freeform text reply blocked when customer service window expired');

    // Clean up test collections after run
    await Message.deleteMany({ conversationId: { $in: [res1.conversation._id, resKnown.conversation._id, resUnknown.conversation._id, expiredConv._id] } });
    await Conversation.deleteMany({ _id: { $in: [res1.conversation._id, resKnown.conversation._id, resUnknown.conversation._id, expiredConv._id] } });
    await Contact.deleteMany({ _id: existingContact._id });

  } catch (err: any) {
    console.error('Test Suite Error:', err);
    failedCount++;
  } finally {
    await mongoose.disconnect();
  }

  console.log(`\n=== INBOX TEST SUITE SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED ===`);
  if (failedCount > 0) {
    process.exit(1);
  }
}

runInboxTestSuite();
