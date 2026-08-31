import mongoose, { Schema, Document } from 'mongoose';

export type CampaignStatus =
  | 'DRAFT'
  | 'READY'
  | 'TESTED'
  | 'QUEUED'
  | 'RUNNING'
  | 'PAUSED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'FAILED'
  | 'INTERRUPTED';

export interface ICampaign extends Document {
  campaignId: string;
  name: string;
  templateName: string;
  templateLanguage: string;
  templateCategory: string;
  templateStatus: string;
  templateComponents: any[];
  headerConfig: any;
  variableMappings: any[];
  audience: any;
  status: CampaignStatus;
  maxMessagesPerHour?: number;
  pauseReason?: string;
  rateLimitCooldownUntil?: Date;
  testMessageStatus?: string;
  testRecipientPhone?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema = new Schema<ICampaign>(
  {
    campaignId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    templateName: { type: String, required: true },
    templateLanguage: { type: String, required: true, default: 'en' },
    templateCategory: { type: String, default: 'MARKETING' },
    templateStatus: { type: String, default: 'APPROVED' },
    templateComponents: { type: Schema.Types.Mixed, default: [] },
    headerConfig: { type: Schema.Types.Mixed, default: { format: 'NONE' } },
    variableMappings: { type: Schema.Types.Mixed, default: [] },
    audience: { type: Schema.Types.Mixed, default: {} },
    maxMessagesPerHour: { type: Number, default: 1000, min: 1, max: 100000 },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'READY',
        'TESTED',
        'QUEUED',
        'RUNNING',
        'PAUSED',
        'CANCELLED',
        'COMPLETED',
        'FAILED',
        'INTERRUPTED',
      ],
      default: 'DRAFT',
      index: true,
    },
    pauseReason: { type: String },
    rateLimitCooldownUntil: { type: Date },
    testMessageStatus: { type: String },
    testRecipientPhone: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

CampaignSchema.index({ status: 1, createdAt: -1 });

export const Campaign = mongoose.model<ICampaign>('Campaign', CampaignSchema);
