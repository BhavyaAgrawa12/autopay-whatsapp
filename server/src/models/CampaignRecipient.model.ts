import mongoose, { Schema, Document } from 'mongoose';

export type RecipientSendStatus = 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'CANCELLED';

export interface ICampaignRecipient extends Document {
  campaignId: string;
  contactId?: mongoose.Types.ObjectId;
  phone: string;
  variableValues: Record<string, string>;
  mediaAssetId?: string;
  status: RecipientSendStatus;
  attempts: number;
  whatsappMessageId?: string;
  errorCode?: string;
  errorReason?: string;
  retryAfter?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignRecipientSchema = new Schema<ICampaignRecipient>(
  {
    campaignId: { type: String, required: true, index: true },
    contactId: { type: Schema.Types.ObjectId, ref: 'Contact', index: true },
    phone: { type: String, required: true },
    variableValues: { type: Schema.Types.Mixed, default: {} },
    mediaAssetId: { type: String },
    status: {
      type: String,
      enum: ['QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELLED'],
      default: 'QUEUED',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    whatsappMessageId: { type: String, index: true },
    errorCode: { type: String },
    errorReason: { type: String },
    retryAfter: { type: Date },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast progress calculations and atomic claiming
CampaignRecipientSchema.index({ campaignId: 1, status: 1 });
CampaignRecipientSchema.index({ campaignId: 1, contactId: 1 });
CampaignRecipientSchema.index({ campaignId: 1, whatsappMessageId: 1 });

export const CampaignRecipient = mongoose.model<ICampaignRecipient>(
  'CampaignRecipient',
  CampaignRecipientSchema
);
