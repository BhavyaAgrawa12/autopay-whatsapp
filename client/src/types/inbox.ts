export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type InboxMessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'STICKER' | 'TEMPLATE' | 'UNKNOWN';
export type InboxMessageStatus = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface ConversationItem {
  _id: string;
  contactId?: string | null;
  phoneNumber: string;
  phoneRaw: string;
  displayName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  messagingWindowExpiresAt?: string | null;
  lastInboundAt?: string | null;
  lastOutboundAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageItem {
  _id: string;
  conversationId: string;
  whatsappMessageId: string;
  direction: MessageDirection;
  messageType: InboxMessageType;
  text: string;
  mediaId?: string;
  from: string;
  to: string;
  status: InboxMessageStatus;
  sentAt: string;
  deliveredAt?: string | null;
  readAt?: string | null;
  failedAt?: string | null;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovedTemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  headerType?: string;
  bodyText?: string;
  footerText?: string;
  variables: string[];
}
