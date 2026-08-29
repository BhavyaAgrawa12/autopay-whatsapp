import app from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { initStorage } from './utils/fileStorage.js';
import { connectDatabase, closeDatabase } from './config/database.js';
import { CampaignSendingService } from './services/campaignSending.service.js';

async function bootstrap() {
  try {
    // 1. Connect MongoDB
    await connectDatabase();

    // 2. Initialize filesystem media directories
    initStorage();

    // 3. Run campaign restart recovery
    await CampaignSendingService.recoverInterruptedCampaigns();

    // 4. Start Express HTTP Server
    const server = app.listen(env.PORT, () => {
      logger.info(`Server initialized and running on port ${env.PORT}`, {
        port: env.PORT,
        environment: env.NODE_ENV,
        healthEndpoint: `http://localhost:${env.PORT}/api/health`,
      });
    });

    const handleShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Gracefully shutting down server...`);
      server.close(async () => {
        await closeDatabase();
        logger.info('Server closed successfully');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
  } catch (err: any) {
    logger.error('[Server Boot] Critical startup failure', { error: err.message || String(err) });
    process.exit(1);
  }
}

bootstrap();
