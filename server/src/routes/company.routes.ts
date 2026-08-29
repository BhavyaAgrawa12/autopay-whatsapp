import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { uploadAssetMiddleware, uploadLogoMiddleware } from '../middlewares/upload.js';
import {
  getCompanyProfile,
  updateCompanyProfile,
  uploadCompanyLogo,
  removeCompanyLogo,
  uploadCompanyFavicon,
  removeCompanyFavicon,
  addService,
  updateService,
  deleteService,
} from '../controllers/company.controller.js';
import {
  getAssets,
  uploadAsset,
  serveAssetFile,
  downloadAssetFile,
  reuploadAssetFile,
  renameAsset,
  deleteAsset,
} from '../controllers/asset.controller.js';

const router = Router();

// PUBLIC UNAUTHENTICATED MEDIA FILE SERVING (MUST BE BEFORE requireAuth)
router.get('/assets/:id/file', serveAssetFile);
router.get('/assets/:id/download', downloadAssetFile);
router.get('/assets/:id', serveAssetFile);

// Protect remaining management routes
router.use(requireAuth);

// Profile & Logo Endpoints
router.get('/', getCompanyProfile);
router.put('/', updateCompanyProfile);
router.post('/logo', uploadLogoMiddleware.single('logo'), uploadCompanyLogo);
router.delete('/logo', removeCompanyLogo);
router.post('/favicon', uploadLogoMiddleware.single('favicon'), uploadCompanyFavicon);
router.delete('/favicon', removeCompanyFavicon);

// Services Endpoints
router.get('/services', getCompanyProfile);
router.post('/services', addService);
router.put('/services/:id', updateService);
router.delete('/services/:id', deleteService);

// Asset Library Endpoints
router.get('/assets', getAssets);
router.post('/assets', uploadAssetMiddleware.single('file'), uploadAsset);
router.post('/assets/:id/file', uploadAssetMiddleware.single('file'), reuploadAssetFile);
router.put('/assets/:id', renameAsset);
router.delete('/assets/:id', deleteAsset);

export const companyRoutes = router;
