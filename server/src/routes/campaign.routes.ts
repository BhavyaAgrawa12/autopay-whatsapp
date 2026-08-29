import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  getCampaigns,
  saveCampaign,
  deleteCampaign,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  getCampaignProgress,
  getCampaignRecipients,
} from '../controllers/campaign.controller.js';

import {
  getCampaignReport,
  exportFailedRecipients,
  exportSuccessfulRecipients,
  exportAllRecipients,
} from '../controllers/report.controller.js';

const router = Router();

// Protect all campaign routes with admin auth
router.use(requireAuth);

router.get('/', getCampaigns);
router.post('/', saveCampaign);
router.delete('/:campaignId', deleteCampaign);

router.post('/:campaignId/send', startCampaign);
router.post('/:campaignId/pause', pauseCampaign);
router.post('/:campaignId/resume', resumeCampaign);
router.post('/:campaignId/cancel', cancelCampaign);
router.get('/:campaignId/progress', getCampaignProgress);
router.get('/:campaignId/recipients', getCampaignRecipients);

router.get('/:campaignId/report', getCampaignReport);
router.get('/:campaignId/export/failed', exportFailedRecipients);
router.get('/:campaignId/export/successful', exportSuccessfulRecipients);
router.get('/:campaignId/export/all', exportAllRecipients);

export const campaignRoutes = router;
