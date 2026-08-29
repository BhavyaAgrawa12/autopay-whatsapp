import { Router, Request, Response } from 'express';
import { HealthService } from '../services/health.service.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const health = HealthService.getHealthStatus();
  const statusCode = health.database.mongodb === 'connected' ? 200 : 503;
  res.status(statusCode).json({
    success: health.database.mongodb === 'connected',
    data: health,
  });
});

router.get('/db', (_req: Request, res: Response) => {
  const dbHealth = HealthService.getDatabaseHealth();
  const statusCode = dbHealth.mongodb === 'connected' ? 200 : 503;
  res.status(statusCode).json({
    success: dbHealth.mongodb === 'connected',
    data: dbHealth,
  });
});

router.get('/webhook', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      configured: true,
      endpoint: '/api/webhooks/whatsapp',
    },
  });
});

export const healthRoutes = router;
