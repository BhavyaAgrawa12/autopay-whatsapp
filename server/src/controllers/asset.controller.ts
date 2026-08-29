import { Request, Response, NextFunction } from 'express';
import { AssetService } from '../services/asset.service.js';

export async function getAssets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { search, category, sort } = req.query;
    const assets = await AssetService.getAssets({
      search: search as string,
      category: category as string,
      sort: sort as any,
    });
    res.status(200).json({
      success: true,
      data: assets,
    });
  } catch (error) {
    next(error);
  }
}

export async function uploadAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = req.file;
    const { description } = req.body;
    const asset = await AssetService.uploadAsset(file!, description);
    res.status(201).json({
      success: true,
      data: asset,
    });
  } catch (error) {
    next(error);
  }
}

export async function serveAssetFile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { fullPath, asset } = await AssetService.getPhysicalFilePath(id);
    res.setHeader('Content-Type', asset.mimeType);
    res.sendFile(fullPath);
  } catch (error) {
    next(error);
  }
}

export async function downloadAssetFile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { fullPath, asset } = await AssetService.getPhysicalFilePath(id);
    res.download(fullPath, asset.originalFilename);
  } catch (error) {
    next(error);
  }
}

export async function renameAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { filename } = req.body;
    const updated = await AssetService.renameAsset(id, filename);
    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    await AssetService.deleteAsset(id);
    res.status(200).json({
      success: true,
      message: 'Asset deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}
