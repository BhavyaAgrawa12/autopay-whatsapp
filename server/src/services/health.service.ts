import { env } from '../config/env.js';
import { isDatabaseConnected } from '../config/database.js';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  database: {
    mongodb: 'connected' | 'disconnected';
  };
}

export class HealthService {
  public static getDatabaseHealth(): { mongodb: 'connected' | 'disconnected' } {
    const ready = isDatabaseConnected();
    return {
      mongodb: ready ? 'connected' : 'disconnected',
    };
  }

  public static getHealthStatus(): HealthStatus {
    const dbHealth = HealthService.getDatabaseHealth();
    return {
      status: dbHealth.mongodb === 'connected' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: env.NODE_ENV,
      version: '1.0.0',
      database: dbHealth,
    };
  }
}
