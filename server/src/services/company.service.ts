import fs from 'fs';
import path from 'path';
import { PROFILE_JSON_PATH, readJson, writeJsonAtomic } from '../utils/fileStorage.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

export interface CompanyServiceItem {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  isActive: boolean;
  order: number;
}

export interface CompanyProfileData {
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

export class CompanyService {
  public static getProfile(): CompanyProfileData {
    return readJson<CompanyProfileData>(PROFILE_JSON_PATH, {
      companyName: 'AutoPay Tech',
      description: '',
      website: '',
      phone: '',
      email: '',
      address: '',
      socialLinks: {},
      services: [],
      updatedAt: new Date().toISOString(),
    });
  }

  public static updateProfile(updateData: Partial<CompanyProfileData>): CompanyProfileData {
    const current = CompanyService.getProfile();

    const updated: CompanyProfileData = {
      ...current,
      ...updateData,
      socialLinks: {
        ...current.socialLinks,
        ...(updateData.socialLinks || {}),
      },
      updatedAt: new Date().toISOString(),
    };

    writeJsonAtomic(PROFILE_JSON_PATH, updated);
    return updated;
  }

  public static updateLogo(logoPath: string): CompanyProfileData {
    return CompanyService.updateProfile({ logoUrl: logoPath });
  }

  public static removeLogo(): CompanyProfileData {
    const profile = CompanyService.getProfile();
    if (profile.logoUrl) {
      try {
        const fullPath = path.join(process.cwd(), profile.logoUrl);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch (err) {
        console.error('Failed to remove old logo file:', err);
      }
    }
    return CompanyService.updateProfile({ logoUrl: undefined });
  }

  // Services Management
  public static getServices(): CompanyServiceItem[] {
    const profile = CompanyService.getProfile();
    return (profile.services || []).sort((a, b) => a.order - b.order);
  }

  public static addService(data: { name: string; description: string; imageUrl?: string; isActive?: boolean }): CompanyServiceItem {
    if (!data.name || !data.name.trim()) {
      throw new ValidationError('Service name is required');
    }

    const profile = CompanyService.getProfile();
    const newService: CompanyServiceItem = {
      id: `srv-${Date.now()}`,
      name: data.name.trim(),
      description: data.description ? data.description.trim() : '',
      imageUrl: data.imageUrl,
      isActive: data.isActive !== undefined ? data.isActive : true,
      order: (profile.services || []).length + 1,
    };

    profile.services.push(newService);
    CompanyService.updateProfile(profile);

    return newService;
  }

  public static updateService(id: string, update: Partial<CompanyServiceItem>): CompanyServiceItem {
    const profile = CompanyService.getProfile();
    const service = profile.services.find((s) => s.id === id);

    if (!service) {
      throw new NotFoundError(`Service with ID '${id}' not found`);
    }

    if (update.name !== undefined) service.name = update.name.trim();
    if (update.description !== undefined) service.description = update.description.trim();
    if (update.imageUrl !== undefined) service.imageUrl = update.imageUrl;
    if (update.isActive !== undefined) service.isActive = update.isActive;
    if (update.order !== undefined) service.order = update.order;

    CompanyService.updateProfile(profile);
    return service;
  }

  public static deleteService(id: string): void {
    const profile = CompanyService.getProfile();
    const initialLen = profile.services.length;
    profile.services = profile.services.filter((s) => s.id !== id);

    if (profile.services.length === initialLen) {
      throw new NotFoundError(`Service with ID '${id}' not found`);
    }

    CompanyService.updateProfile(profile);
  }
}
