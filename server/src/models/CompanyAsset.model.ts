import mongoose, { Schema, Document } from 'mongoose';

export type AssetCategory = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'GIF';

export interface ICompanyAsset extends Document {
  assetId: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  category: AssetCategory;
  fileSize: number;
  description?: string;
  relativePath: string;
  createdAt: Date;
  updatedAt: Date;
}

const CompanyAssetSchema = new Schema<ICompanyAsset>(
  {
    assetId: { type: String, required: true, unique: true, index: true },
    originalFilename: { type: String, required: true },
    storedFilename: { type: String, required: true },
    mimeType: { type: String, required: true },
    category: {
      type: String,
      enum: ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'GIF'],
      required: true,
      index: true,
    },
    fileSize: { type: Number, required: true },
    description: { type: String },
    relativePath: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

export const CompanyAsset = mongoose.model<ICompanyAsset>('CompanyAsset', CompanyAssetSchema);
