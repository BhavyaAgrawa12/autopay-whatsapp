import mongoose, { Schema, Document } from 'mongoose';

export type MessageEventStatus = 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface IMessageEvent extends Document {
  campaignId?: string;
  campaignRecipientId?: mongoose.Types.ObjectId;
  whatsappMessageId: string;
  status: MessageEventStatus;
  eventTimestamp: Date;
  receivedAt: Date;
  errorCode?: number | string;
  errorTitle?: string;
}

const MessageEventSchema: Schema = new Schema(
  {
    campaignId: { type: String, index: true },
    campaignRecipientId: { type: Schema.Types.ObjectId, ref: 'CampaignRecipient', index: true },
    whatsappMessageId: { type: String, required: true, index: true },
    status: { type: String, enum: ['SENT', 'DELIVERED', 'READ', 'FAILED'], required: true },
    eventTimestamp: { type: Date, required: true },
    receivedAt: { type: Date, default: Date.now },
    errorCode: { type: Schema.Types.Mixed },
    errorTitle: { type: String },
  },
  {
    timestamps: true,
  }
);

// Idempotency: Unique compound index prevents duplicate webhook status events for the same message ID
MessageEventSchema.index({ whatsappMessageId: 1, status: 1 }, { unique: true });

export const MessageEvent = mongoose.model<IMessageEvent>('MessageEvent', MessageEventSchema);
