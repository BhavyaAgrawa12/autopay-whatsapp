import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { CompanyAsset, AssetCategory, ICompanyAsset } from '../models/CompanyAsset.model.js';
import { ASSETS_MEDIA_DIR, sanitizeFilename } from '../utils/fileStorage.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

export class AssetService {
  private static determineCategory(extension: string, mimeType: string): AssetCategory {
    const ext = extension.toLowerCase();
    const mime = mimeType.toLowerCase();

    if (ext === '.gif' || mime === 'image/gif') return 'GIF';
    if (['.jpg', '.jpeg', '.png', '.webp', '.svg'].includes(ext) || mime.startsWith('image/')) return 'IMAGE';
    if (['.mp4', '.webm', '.mov'].includes(ext) || mime.startsWith('video/')) return 'VIDEO';
    if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext) || mime.startsWith('audio/')) return 'AUDIO';
    return 'DOCUMENT';
  }

  public static async getAssets(query?: {
    search?: string;
    category?: string;
    sort?: 'newest' | 'oldest' | 'name' | 'size';
  }): Promise<ICompanyAsset[]> {
    const filterQuery: any = {};

    if (query?.category && query.category !== 'ALL') {
      filterQuery.category = query.category.toUpperCase();
    }

    if (query?.search && query.search.trim()) {
      const term = query.search.toLowerCase().trim();
      const regex = new RegExp(term, 'i');
      filterQuery.$or = [{ originalFilename: regex }, { description: regex }];
    }

    let sortOptions: any = { createdAt: -1 };
    const sortMode = query?.sort || 'newest';
    if (sortMode === 'oldest') sortOptions = { createdAt: 1 };
    else if (sortMode === 'name') sortOptions = { originalFilename: 1 };
    else if (sortMode === 'size') sortOptions = { fileSize: -1 };

    return CompanyAsset.find(filterQuery).sort(sortOptions);
  }

  public static async getAssetById(assetId: string): Promise<ICompanyAsset> {
    let asset = await CompanyAsset.findOne({ assetId });
    if (!asset && mongoose.Types.ObjectId.isValid(assetId)) {
      asset = await CompanyAsset.findById(assetId);
    }
    if (!asset) {
      throw new NotFoundError(`Asset with ID '${assetId}' not found`);
    }
    return asset;
  }

  public static async uploadAsset(file: Express.Multer.File, description?: string): Promise<ICompanyAsset> {
    if (!file) {
      throw new ValidationError('No file provided for upload');
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const category = AssetService.determineCategory(ext, file.mimetype);

    const newAsset = new CompanyAsset({
      assetId: `asset-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      originalFilename: sanitizeFilename(file.originalname),
      storedFilename: file.filename,
      mimeType: file.mimetype,
      category,
      fileSize: file.size,
      description: description ? description.trim() : undefined,
      relativePath: `/storage/company/assets/${file.filename}`,
    });

    await newAsset.save();
    return newAsset;
  }

  public static async reuploadAsset(assetId: string, file: Express.Multer.File): Promise<ICompanyAsset> {
    if (!file) {
      throw new ValidationError('No file provided for re-upload');
    }

    const asset = await AssetService.getAssetById(assetId);

    try {
      const oldPath = path.join(ASSETS_MEDIA_DIR, asset.storedFilename);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    } catch (e) {
      console.warn('Could not remove old physical file:', e);
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const category = AssetService.determineCategory(ext, file.mimetype);

    asset.storedFilename = file.filename;
    asset.mimeType = file.mimetype;
    asset.category = category;
    asset.fileSize = file.size;
    asset.relativePath = `/storage/company/assets/${file.filename}`;

    await asset.save();
    return asset;
  }

  public static async renameAsset(assetId: string, newFilename: string): Promise<ICompanyAsset> {
    if (!newFilename || !newFilename.trim()) {
      throw new ValidationError('New filename cannot be empty');
    }

    const asset = await AssetService.getAssetById(assetId);

    const sanitized = sanitizeFilename(newFilename.trim());
    const oldExt = path.extname(asset.originalFilename);
    const newExt = path.extname(sanitized);

    asset.originalFilename = newExt ? sanitized : `${sanitized}${oldExt}`;
    await asset.save();
    return asset;
  }

  public static async deleteAsset(assetId: string): Promise<void> {
    const asset = await AssetService.getAssetById(assetId);

    try {
      const fullPath = path.join(ASSETS_MEDIA_DIR, asset.storedFilename);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (err) {
      console.error(`Failed to delete physical asset file '${asset.storedFilename}':`, err);
    }

    await CompanyAsset.deleteOne({ _id: asset._id });
  }

  public static async getPhysicalFilePath(assetId: string): Promise<{ fullPath: string; asset: ICompanyAsset; isMissing: boolean }> {
    const asset = await AssetService.getAssetById(assetId);
    const fullPath = path.join(ASSETS_MEDIA_DIR, asset.storedFilename);

    if (!fullPath.startsWith(ASSETS_MEDIA_DIR)) {
      throw new ValidationError('Invalid path traversal detected');
    }

    const isMissing = !fs.existsSync(fullPath);
    return { fullPath, asset, isMissing };
  }
}
