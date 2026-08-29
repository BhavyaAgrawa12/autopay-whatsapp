export type AssetCategory = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'GIF';

export interface CompanyServiceItem {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  isActive: boolean;
  order: number;
}

export interface CompanyProfile {
  companyName: string;
  description: string;
  website: string;
  phone: string;
  email: string;
  address: string;
  logoUrl?: string;
  socialLinks: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
  };
  services: CompanyServiceItem[];
  updatedAt: string;
}

export interface CompanyAssetRecord {
  id: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  category: AssetCategory;
  fileSize: number;
  description?: string;
  relativePath: string;
  uploadedAt: string;
}
