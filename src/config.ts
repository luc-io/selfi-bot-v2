import * as dotenv from 'dotenv';
dotenv.config();

// Admin configuration
export const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID 
  ? parseInt(process.env.ADMIN_TELEGRAM_ID)
  : null;

export const isDev = process.env.NODE_ENV === 'development';

// Telegram Bot
export const BOT_TOKEN = process.env.BOT_TOKEN!;
export const WEBHOOK_DOMAIN = process.env.WEBHOOK_DOMAIN!;
export const WEBHOOK_PATH = '/bot';

// Database
export const DATABASE_URL = process.env.DATABASE_URL!;

// File storage
export const TELEGRAM_FILE_API_URL = 'https://api.telegram.org/file/bot' + BOT_TOKEN;
export const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
export const PUBLIC_URL = process.env.PUBLIC_URL!;

// Redis
export const REDIS_URL = process.env.REDIS_URL!;

// Model paths
export const DEFAULT_BASE_MODEL_PATH = process.env.DEFAULT_BASE_MODEL_PATH!;
export const LORA_BASE_PATH = process.env.LORA_BASE_PATH!;

// Stability settings
export const TRAINING_TIMEOUT = 1000 * 60 * 30; // 30 minutes
export const GENERATION_TIMEOUT = 1000 * 60 * 5; // 5 minutes