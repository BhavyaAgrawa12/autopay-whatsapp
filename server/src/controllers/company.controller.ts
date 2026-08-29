import { Request, Response, NextFunction } from 'express';
import { CompanyProfile } from '../models/CompanyProfile.model.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';

export async function getCompanyProfile(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let profile = await CompanyProfile.findOne();
    if (!profile) {
      profile = await CompanyProfile.create({
        companyName: 'AutoPay Tech',
        description: 'Leading IT Solutions Provider',
        website: 'https://autopaytech.com',
        phone: '+91 98765 43210',
        email: 'contact@autopaytech.com',
        address: 'Jaipur, Rajasthan, India',
        socialLinks: { linkedin: '', twitter: '', facebook: '', instagram: '' },
        services: [
          { id: 'srv-1', name: 'Software Development', description: 'Custom web & mobile app engineering', isActive: true, order: 1 },
          { id: 'srv-2', name: 'Cloud Infrastructure', description: 'AWS & Azure cloud migrations', isActive: true, order: 2 },
        ],
      });
    }

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCompanyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { companyName, description, website, phone, email, address, socialLinks } = req.body;

    let profile = await CompanyProfile.findOne();
    if (!profile) {
      profile = new CompanyProfile();
    }

    if (companyName) profile.companyName = companyName.trim();
    if (description !== undefined) profile.description = description.trim();
    if (website !== undefined) profile.website = website.trim();
    if (phone !== undefined) profile.phone = phone.trim();
    if (email !== undefined) profile.email = email.trim();
    if (address !== undefined) profile.address = address.trim();
    if (socialLinks) profile.socialLinks = { ...profile.socialLinks, ...socialLinks };

    await profile.save();

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
}

export async function uploadCompanyLogo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = req.file;
    if (!file) throw new ValidationError('No logo image uploaded');

    let profile = await CompanyProfile.findOne();
    if (!profile) profile = new CompanyProfile();

    profile.logoUrl = `/storage/company/logo/${file.filename}`;
    await profile.save();

    res.status(200).json({
      success: true,
      data: { logoUrl: profile.logoUrl, profile },
    });
  } catch (error) {
    next(error);
  }
}

export async function removeCompanyLogo(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let profile = await CompanyProfile.findOne();
    if (profile) {
      profile.logoUrl = undefined;
      await profile.save();
    }
    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
}

export async function addService(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) throw new ValidationError('Service name is required');

    let profile = await CompanyProfile.findOne();
    if (!profile) profile = new CompanyProfile();

    const services = profile.services || [];
    const newService = {
      id: `srv-${Date.now()}`,
      name: name.trim(),
      description: description ? description.trim() : '',
      isActive: true,
      order: services.length + 1,
    };

    services.push(newService);
    profile.services = services;
    await profile.save();

    res.status(201).json({
      success: true,
      data: newService,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateService(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    let profile = await CompanyProfile.findOne();
    if (!profile) throw new NotFoundError('Company profile not found');

    const services = profile.services || [];
    const service = services.find((s) => s.id === id);
    if (!service) throw new NotFoundError(`Service with ID '${id}' not found`);

    if (name) service.name = name.trim();
    if (description !== undefined) service.description = description.trim();
    if (isActive !== undefined) service.isActive = Boolean(isActive);

    profile.services = services;
    profile.markModified('services');
    await profile.save();

    res.status(200).json({
      success: true,
      data: service,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteService(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    let profile = await CompanyProfile.findOne();
    if (!profile) throw new NotFoundError('Company profile not found');

    profile.services = (profile.services || []).filter((s) => s.id !== id);
    profile.markModified('services');
    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Service deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}
