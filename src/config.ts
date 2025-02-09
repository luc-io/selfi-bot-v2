import * as dotenv from 'dotenv';
dotenv.config();

interface Config {
  // Admin configuration
  ADMIN_TELEGRAM_ID: number | null;
  NODE_ENV: string;
  isDev: boolean;

  // Server
  PORT: string;

  // Telegram Bot
  TELEGRAM_BOT_TOKEN: string;
  BOT_TOKEN: string;
  WEBHOOK_DOMAIN: string;
  WEBHOOK_PATH: string;
  MINIAPP_URL: string;

  // Database
  DATABASE_URL: string;

  // File storage
  TELEGRAM_FILE_API_URL: string;
  UPLOAD_DIR: string;
  PUBLIC_URL: string;

  // Redis
  REDIS_URL: string;

  // Model paths
  DEFAULT_BASE_MODEL_PATH: string;
  LORA_BASE_PATH: string;

  // Stability settings
  TRAINING_TIMEOUT: number;
  GENERATION_TIMEOUT: number;
}

export const config: Config = {
  ADMIN_TELEGRAM_ID: process.env.ADMIN_TELEGRAM_ID 
    ? parseInt(process.env.ADMIN_TELEGRAM_ID)
    : null,
  NODE_ENV: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV === 'development',

  // Server
  PORT: process.env.PORT || '3000',

  // Telegram Bot
  TELEGRAM_BOT_TOKEN: process.env.BOT_TOKEN!,
  BOT_TOKEN: process.env.BOT_TOKEN!,
  WEBHOOK_DOMAIN: process.env.WEBHOOK_DOMAIN!,
  WEBHOOK_PATH: '/bot',
  MINIAPP_URL: process.env.MINIAPP_URL!,

  // Database
  DATABASE_URL: process.env.DATABASE_URL!,

  // File storage
  TELEGRAM_FILE_API_URL: 'https://api.telegram.org/file/bot' + process.env.BOT_TOKEN,
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  PUBLIC_URL: process.env.PUBLIC_URL!,

  // Redis
  REDIS_URL: process.env.REDIS_URL!,

  // Model paths
  DEFAULT_BASE_MODEL_PATH: process.env.DEFAULT_BASE_MODEL_PATH!,
  LORA_BASE_PATH: process.env.LORA_BASE_PATH!,

  // Stability settings
  TRAINING_TIMEOUT: 1000 * 60 * 30, // 30 minutes
  GENERATION_TIMEOUT: 1000 * 60 * 5, // 5 minutes
};

// For backwards compatibility and direct access
export const {
  ADMIN_TELEGRAM_ID,
  NODE_ENV,
  isDev,
  PORT,
  TELEGRAM_BOT_TOKEN,
  BOT_TOKEN,
  WEBHOOK_DOMAIN,
  WEBHOOK_PATH,
  MINIAPP_URL,
  DATABASE_URL,
  TELEGRAM_FILE_API_URL,
  UPLOAD_DIR,
  PUBLIC_URL,
  REDIS_URL,
  DEFAULT_BASE_MODEL_PATH,
  LORA_BASE_PATH,
  TRAINING_TIMEOUT,
  GENERATION_TIMEOUT,
} = config;