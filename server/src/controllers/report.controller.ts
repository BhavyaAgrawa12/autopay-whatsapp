import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/report.service.js';

export async function getCampaignReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { campaignId } = req.params;
    const reportData = await ReportService.getCampaignReportData(campaignId);

    res.status(200).json({
      success: true,
      data: reportData,
    });
  } catch (error) {
    next(error);
  }
}

export async function exportFailedRecipients(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { campaignId } = req.params;
    const { filename, buffer } = await ReportService.generateExcelExport(campaignId, 'failed');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
}

export async function exportSuccessfulRecipients(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { campaignId } = req.params;
    const { filename, buffer } = await ReportService.generateExcelExport(campaignId, 'successful');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
}

export async function exportAllRecipients(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { campaignId } = req.params;
    const { filename, buffer } = await ReportService.generateExcelExport(campaignId, 'all');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
}
