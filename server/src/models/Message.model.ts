import mongoose, { Schema, Document } from 'mongoose';

export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type InboxMessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'STICKER' | 'TEMPLATE' | 'UNKNOWN';
export type InboxMessageStatus = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface IMessage extends Document {
  conversationId: mongoose.Types.ObjectId;
  whatsappMessageId: string;
  direction: MessageDirection;
  messageType: InboxMessageType;
  text: string;
  mediaId?: string;
  from: string;
  to: string;
  status: InboxMessageStatus;
  sentAt: Date;
  deliveredAt?: Date | null;
  readAt?: Date | null;
  failedAt?: Date | null;
  errorCode?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    whatsappMessageId: { type: String, required: true, unique: true, index: true, trim: true },
    direction: { type: String, enum: ['INBOUND', 'OUTBOUND'], required: true, index: true },
    messageType: {
      type: String,
      enum: ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER', 'TEMPLATE', 'UNKNOWN'],
      default: 'TEXT',
    },
    text: { type: String, default: '' },
    mediaId: { type: String, default: '' },
    from: { type: String, required: true, trim: true },
    to: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['SENT', 'DELIVERED', 'READ', 'FAILED'],
      default: 'SENT',
      index: true,
    },
    sentAt: { type: Date, default: Date.now },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    errorCode: { type: String, default: '' },
    errorMessage: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

// Indexes for conversation history sorting and wamid lookup
MessageSchema.index({ conversationId: 1, createdAt: 1 });
MessageSchema.index({ conversationId: 1, createdAt: -1 });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
