import { z } from 'zod';

const configSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  TELEGRAM_BOT_TOKEN: z.string(),
  FAL_API_KEY: z.string(),
  MINIAPP_URL: z.string(),
  ALLOWED_ORIGINS: z.array(z.string()).default(['http://localhost:5173']),
});

// Parse environment variables
const envConfig = {
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  FAL_API_KEY: process.env.FAL_API_KEY,
  MINIAPP_URL: process.env.MINIAPP_URL,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',') || undefined,
};

// Validate and export config
export const config = configSchema.parse(envConfig);