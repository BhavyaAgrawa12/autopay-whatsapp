import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { Campaign } from '../models/Campaign.model.js';
import { CampaignRecipient } from '../models/CampaignRecipient.model.js';
import { CampaignSendingService } from '../services/campaignSending.service.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';

export async function getCampaigns(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const campaigns = await Campaign.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: campaigns.map((c) => ({
        ...c.toObject(),
        id: c.campaignId || c._id.toString(),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function saveCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const campaignData = req.body;
    if (!campaignData.name || !campaignData.templateName) {
      throw new ValidationError('Campaign name and template name are required.');
    }

    const campaignId = campaignData.campaignId || campaignData.id || `campaign-${Date.now()}`;
    delete campaignData.id;

    const isObjId = mongoose.Types.ObjectId.isValid(campaignId);
    const filter = {
      $or: [
        { campaignId: campaignId },
        ...(isObjId ? [{ _id: new mongoose.Types.ObjectId(campaignId) }] : []),
      ],
    };

    const campaign = await Campaign.findOneAndUpdate(
      filter,
      { ...campaignData, campaignId },
      { returnDocument: 'after', upsert: true }
    );

    res.status(200).json({
      success: true,
      data: {
        ...campaign.toObject(),
        id: campaign.campaignId || campaign._id.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { campaignId } = req.params;
    const isObjId = mongoose.Types.ObjectId.isValid(campaignId);
    const campaign = await Campaign.findOneAndDelete({
      $or: [
        { campaignId: campaignId },
        ...(isObjId ? [{ _id: new mongoose.Types.ObjectId(campaignId) }] : []),
      ],
    });
    if (!campaign) {
      throw new NotFoundError(`Campaign '${campaignId}' not found.`);
    }
    res.status(200).json({
      success: true,
      message: 'Campaign deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function startCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { campaignId } = req.params;
    const result = await CampaignSendingService.startCampaign(campaignId, req.body?.recipients);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function pauseCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { campaignId } = req.params;
    await CampaignSendingService.pauseCampaign(campaignId);
    res.status(200).json({
      success: true,
      message: 'Campaign execution paused successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function resumeCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { campaignId } = req.params;
    await CampaignSendingService.resumeCampaign(campaignId);
    res.status(200).json({
      success: true,
      message: 'Campaign execution resumed successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { campaignId } = req.params;
    await CampaignSendingService.cancelCampaign(campaignId);
    res.status(200).json({
      success: true,
      message: 'Campaign execution cancelled successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function retryFailedRecipients(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { campaignId } = req.params;
    const result = await CampaignSendingService.retryFailedRecipients(campaignId);
    res.status(200).json({
      success: true,
      data: result,
      message: `Retried ${result.retriedCount} recipients.${
        result.blockedCount > 0
          ? ` ${result.blockedCount} recipients are blocked by Meta 24h marketing limit cooldown.`
          : ''
      }`,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCampaignProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { campaignId } = req.params;
    const progress = await CampaignSendingService.getCampaignProgress(campaignId);

    res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCampaignRecipients(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { campaignId } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const rawLimit = parseInt(req.query.limit as string, 10) || 50;
    const limit = Math.min(Math.max(1, rawLimit), 100); // Enforce safe maximum limit of 100
    const statusFilter = req.query.status as string;
    const searchQuery = req.query.search as string;

    const query: any = { campaignId };

    if (statusFilter && statusFilter.trim().length > 0) {
      query.status = statusFilter.toUpperCase();
    }

    if (searchQuery && searchQuery.trim().length > 0) {
      query.$or = [
        { phone: { $regex: searchQuery, $options: 'i' } },
        { whatsappMessageId: { $regex: searchQuery, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [recipients, total] = await Promise.all([
      CampaignRecipient.find(query)
        .populate('contactId', 'name phoneRaw marketingOptIn')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      CampaignRecipient.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        recipients,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}
