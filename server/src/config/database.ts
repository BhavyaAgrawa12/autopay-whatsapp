import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let isConnected = false;

export async function connectDatabase(): Promise<typeof mongoose> {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  try {
    mongoose.connection.on('connected', () => {
      isConnected = true;
      logger.info('[MongoDB] Connected');
    });

    mongoose.connection.on('error', (err) => {
      isConnected = false;
      logger.error('[MongoDB] Connection error', { error: err.message || String(err) });
    });

    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      logger.warn('[MongoDB] Disconnected');
    });

    const instance = await mongoose.connect(env.MONGODB_URI);
    isConnected = true;
    return instance;
  } catch (err: any) {
    isConnected = false;
    const errMsg = err.message || String(err);
    if (errMsg.includes('security-whitelist') || errMsg.includes('MongoServerSelectionError')) {
      logger.error('================================================================');
      logger.error('❌ MONGODB CONNECTION FAILED: IP Not Whitelisted on MongoDB Atlas');
      logger.error('Your current IP address is not whitelisted in Atlas Network Access.');
      logger.error('Fix: Log in to MongoDB Atlas -> Network Access -> Add IP Address (or 0.0.0.0/0).');
      logger.error('Alternatively, use a local MongoDB URI in server/.env if local MongoDB is installed.');
      logger.error('================================================================');
    }
    logger.error('[MongoDB] Failed to establish initial connection', { error: errMsg });
    throw err;
  }
}

export function isDatabaseConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

export async function closeDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    isConnected = false;
    logger.info('[MongoDB] Connection closed gracefully');
  }
}
