import { z } from 'zod';
import 'dotenv/config';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  PORT: z.string().default('3000'),
  
  // Bot
  TELEGRAM_BOT_TOKEN: z.string(),
  TELEGRAM_PAYMENT_TOKEN: z.string().optional(),
  MINIAPP_URL: z.string().default('https://selfi-dev.blackiris.art'),
  
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