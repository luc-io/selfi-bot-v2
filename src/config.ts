import 'dotenv/config';
import { z } from 'zod';

const configSchema = z.object({
  // Bot
  TELEGRAM_BOT_TOKEN: z.string(),
  TELEGRAM_PAYMENT_TOKEN: z.string(),
  
  // Server
  PORT: z.string().transform(Number).default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Database
  DATABASE_URL: z.string(),
  
  // Storage
  SPACES_BUCKET: z.string(),
  SPACES_ENDPOINT: z.string(),
  SPACES_KEY: z.string(),
  SPACES_SECRET: z.string(),

  // FAL
  FAL_KEY: z.string(),
  FAL_KEY_SECRET: z.string(),
});

export const config = configSchema.parse(process.env);

// Derived configuration
export const isDev = config.NODE_ENV === 'development';
export const isProd = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';