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
    const { fullPath, asset, isMissing, buffer } = await AssetService.getPhysicalFilePath(id);

    if (!isMissing) {
      res.setHeader('Content-Type', asset.mimeType);
      res.sendFile(fullPath);
      return;
    }

    if (buffer) {
      res.setHeader('Content-Type', asset.mimeType);
      res.status(200).send(buffer);
      return;
    }

    const svgPlaceholder = `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
        <rect width="100%" height="100%" fill="#090d16"/>
        <rect x="20" y="20" width="360" height="260" rx="16" fill="#0f172a" stroke="#1e293b" stroke-width="2"/>
        <circle cx="200" cy="110" r="32" fill="#334155" opacity="0.5"/>
        <path d="M188 98L212 122M212 98L188 122" stroke="#f43f5e" stroke-width="4" stroke-linecap="round"/>
        <text x="200" y="175" fill="#f87171" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle">File Missing on Server Disk</text>
        <text x="200" y="200" fill="#94a3b8" font-family="sans-serif" font-size="11" text-anchor="middle">Click 'Re-upload' on asset card to restore</text>
      </svg>
    `;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(200).send(svgPlaceholder);
  } catch (error) {
    next(error);
  }
}

export async function downloadAssetFile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { fullPath, asset, isMissing } = await AssetService.getPhysicalFilePath(id);
    if (isMissing) {
      res.status(404).send('Physical file missing from server disk. Please re-upload via Company Assets page.');
      return;
    }
    res.download(fullPath, asset.originalFilename);
  } catch (error) {
    next(error);
  }
}

export async function reuploadAssetFile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const file = req.file;
    const updated = await AssetService.reuploadAsset(id, file!);
    res.status(200).json({
      success: true,
      data: updated,
    });
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
