import mongoose, { Schema, Document } from 'mongoose';

export type MarketingOptInStatus = 'OPTED_IN' | 'OPTED_OUT' | 'UNKNOWN';

export interface IContact extends Document {
  name: string;
  phoneRaw: string;
  phoneNormalized: string;
  email?: string;
  company?: string;
  city?: string;
  service?: string;
  marketingOptIn: MarketingOptInStatus;
  customFields?: Record<string, string>;
  source?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ContactSchema = new Schema<IContact>(
  {
    name: { type: String, required: true, trim: true },
    phoneRaw: { type: String, required: true, trim: true },
    phoneNormalized: { type: String, required: true, unique: true, index: true, trim: true },
    email: { type: String, trim: true },
    company: { type: String, trim: true },
    city: { type: String, trim: true },
    service: { type: String, trim: true },
    marketingOptIn: {
      type: String,
      enum: ['OPTED_IN', 'OPTED_OUT', 'UNKNOWN'],
      default: 'OPTED_IN',
      index: true,
    },
    customFields: { type: Schema.Types.Mixed, default: {} },
    source: { type: String, default: 'EXCEL_IMPORT' },
  },
  {
    timestamps: true,
  }
);

// Search indexes
ContactSchema.index({ name: 'text', company: 'text', city: 'text', email: 'text' });

export const Contact = mongoose.model<IContact>('Contact', ContactSchema);
