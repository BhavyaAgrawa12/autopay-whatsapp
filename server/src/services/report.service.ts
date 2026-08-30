import XLSX from 'xlsx';
import { Campaign, ICampaign } from '../models/Campaign.model.js';
import { CampaignRecipient } from '../models/CampaignRecipient.model.js';
import { NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface CampaignReportMetrics {
  total: number;
  queued: number;
  sending: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  skipped: number;
  deliveryRate: number;
  readRate: number;
  failureRate: number;
  durationSeconds: number;
  durationFormatted: string;
}

export interface CampaignReportSummary {
  campaign: {
    id: string;
    name: string;
    templateName: string;
    templateLanguage: string;
    status: string;
    headerFormat?: string;
    audienceCount: number;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
  };
  metrics: CampaignReportMetrics;
}

export class ReportService {
  /**
   * Generates summary metrics and metadata for a campaign report
   */
  public static async getCampaignReportData(campaignId: string): Promise<CampaignReportSummary> {
    const campaign = await Campaign.findOne({ campaignId });
    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    const counts = await CampaignRecipient.aggregate([
      { $match: { campaignId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    let total = 0;
    let queued = 0;
    let sending = 0;
    let rawSent = 0;
    let rawDelivered = 0;
    let rawRead = 0;
    let failed = 0;
    let skipped = 0;

    counts.forEach((item) => {
      const c = item.count;
      total += c;
      if (item._id === 'QUEUED') queued = c;
      if (item._id === 'SENDING') sending = c;
      if (item._id === 'SENT') rawSent = c;
      if (item._id === 'DELIVERED') rawDelivered = c;
      if (item._id === 'READ') rawRead = c;
      if (item._id === 'FAILED') failed = c;
      if (item._id === 'CANCELLED') skipped = c;
    });

    const read = rawRead;
    const delivered = rawDelivered + rawRead;
    const sent = rawSent + rawDelivered + rawRead;

    const deliveryRate = sent > 0 ? Number(((delivered / sent) * 100).toFixed(2)) : 0;
    const readRate = delivered > 0 ? Number(((read / delivered) * 100).toFixed(2)) : 0;
    const failureRate = total > 0 ? Number(((failed / total) * 100).toFixed(2)) : 0;

    let durationSeconds = 0;
    let durationFormatted = 'N/A';

    if (campaign.startedAt) {
      const endTime = campaign.completedAt ? new Date(campaign.completedAt).getTime() : Date.now();
      const startTime = new Date(campaign.startedAt).getTime();
      durationSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));

      const mins = Math.floor(durationSeconds / 60);
      const secs = durationSeconds % 60;
      durationFormatted = `${mins}m ${secs}s`;
    }

    return {
      campaign: {
        id: campaign.campaignId,
        name: campaign.name,
        templateName: campaign.templateName,
        templateLanguage: campaign.templateLanguage,
        status: campaign.status,
        headerFormat: campaign.headerConfig?.format,
        audienceCount: campaign.audience?.eligibleCount || total,
        createdAt: campaign.createdAt,
        startedAt: campaign.startedAt,
        completedAt: campaign.completedAt,
      },
      metrics: {
        total,
        queued,
        sending,
        sent,
        delivered,
        read,
        failed,
        skipped,
        deliveryRate,
        readRate,
        failureRate,
        durationSeconds,
        durationFormatted,
      },
    };
  }

  /**
   * Generates a downloadable .xlsx Excel buffer for campaign recipient exports
   */
  public static async generateExcelExport(
    campaignId: string,
    exportType: 'failed' | 'successful' | 'all'
  ): Promise<{ filename: string; buffer: Buffer; count: number }> {
    const campaign = await Campaign.findOne({ campaignId });
    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    const sanitizedName = campaign.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    let typeSuffix = 'Complete-Report';
    const query: any = { campaignId };

    if (exportType === 'failed') {
      typeSuffix = 'Failed';
      query.status = 'FAILED';
    } else if (exportType === 'successful') {
      typeSuffix = 'Successful';
      query.status = { $in: ['SENT', 'DELIVERED', 'READ'] };
    }

    const filename = `${sanitizedName}-${typeSuffix}-${dateStr}.xlsx`;

    // Fetch records populated with Contact info
    const recipients = await CampaignRecipient.find(query)
      .populate('contactId')
      .sort({ createdAt: -1 })
      .lean();

    const rows = recipients.map((r: any) => {
      const contact = r.contactId || {};
      const customFields = contact.customFields || {};

      return {
        'Contact Name': contact.name || r.name || 'N/A',
        'Phone Number': String(r.phone || ''),
        'Email Address': contact.email || 'N/A',
        'Company': contact.company || 'N/A',
        'City': contact.city || 'N/A',
        'Service': contact.service || 'N/A',
        'Opt-in Status': contact.marketingOptIn || 'OPTED_IN',
        'Campaign Status': r.status,
        'WhatsApp Message ID': r.whatsappMessageId || 'N/A',
        'Sent At': r.sentAt ? new Date(r.sentAt).toLocaleString() : 'N/A',
        'Delivered At': r.deliveredAt ? new Date(r.deliveredAt).toLocaleString() : 'N/A',
        'Read At': r.readAt ? new Date(r.readAt).toLocaleString() : 'N/A',
        'Error Code': r.errorCode || 'N/A',
        'Error Reason':
          r.errorCode === '131049' || r.errorCode === '131026' || (r.errorReason || '').includes('healthy ecosystem engagement')
            ? 'Not delivered — Meta marketing delivery limit'
            : r.errorReason || 'N/A',
        'Retry Eligible At': r.retryAfter ? new Date(r.retryAfter).toLocaleString() : 'N/A',
        'Attempts': r.attempts || 0,
        ...customFields,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Recipients');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    logger.info(`[ReportService] Generated ${exportType} Excel report`, {
      campaignId,
      filename,
      rowCount: rows.length,
    });

    return {
      filename,
      buffer,
      count: rows.length,
    };
  }
}
