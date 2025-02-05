import { z } from 'zod';

const configSchema = z.object({
  // Server
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  PUBLIC_URL: z.string(),
  MINIAPP_URL: z.string(),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string(),
  TELEGRAM_PAYMENT_TOKEN: z.string().optional(),

  // FAL AI
  FAL_KEY: z.string(),
  FAL_KEY_SECRET: z.string(),

  // Database
  DATABASE_URL: z.string(),

  // Digital Ocean Spaces
  SPACES_KEY: z.string(),
  SPACES_SECRET: z.string(),
  SPACES_BUCKET: z.string(),
  SPACES_ENDPOINT: z.string(),

  // Derived settings
  ALLOWED_ORIGINS: z.array(z.string()).default(['http://localhost:5173'])
});

// Parse environment variables
const envConfig = {
  // Server
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  PUBLIC_URL: process.env.PUBLIC_URL,
  MINIAPP_URL: process.env.MINIAPP_URL,

  // Telegram
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_PAYMENT_TOKEN: process.env.TELEGRAM_PAYMENT_TOKEN,

  // FAL AI
  FAL_KEY: process.env.FAL_KEY,
  FAL_KEY_SECRET: process.env.FAL_KEY_SECRET,

  // Database
  DATABASE_URL: process.env.DATABASE_URL,

  // Digital Ocean Spaces
  SPACES_KEY: process.env.SPACES_KEY,
  SPACES_SECRET: process.env.SPACES_SECRET,
  SPACES_BUCKET: process.env.SPACES_BUCKET,
  SPACES_ENDPOINT: process.env.SPACES_ENDPOINT,

  // Derived settings
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',') || undefined,
};

// Validate and export config
export const config = configSchema.parse(envConfig);