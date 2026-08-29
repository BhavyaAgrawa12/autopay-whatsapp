import { Request, Response } from 'express';
import { HealthService } from '../services/health.service.js';

export function getHealthStatus(_req: Request, res: Response): void {
  const health = HealthService.getHealthStatus();
  res.status(200).json({
    success: true,
    data: health,
  });
}
