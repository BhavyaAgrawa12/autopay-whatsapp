import mongoose, { Schema, Document } from 'mongoose';

export interface ICompanyProfile extends Document {
  companyName: string;
  description?: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  logoUrl?: string;
  socialLinks?: Record<string, string>;
  services?: Array<{
    id: string;
    name: string;
    description: string;
    imageUrl?: string;
    isActive: boolean;
    order: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const CompanyProfileSchema = new Schema<ICompanyProfile>(
  {
    companyName: { type: String, required: true, default: 'AutoPay Tech' },
    description: { type: String, default: '' },
    website: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    address: { type: String, default: '' },
    logoUrl: { type: String },
    socialLinks: { type: Schema.Types.Mixed, default: {} },
    services: { type: Schema.Types.Mixed, default: [] },
  },
  {
    timestamps: true,
  }
);

export const CompanyProfile = mongoose.model<ICompanyProfile>('CompanyProfile', CompanyProfileSchema);
