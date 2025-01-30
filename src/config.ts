import 'dotenv/config';
import { z } from 'zod';

const configSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string(),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string(),
  SPACES_BUCKET: z.string(),
  SPACES_ENDPOINT: z.string(),
  SPACES_KEY: z.string(),
  SPACES_SECRET: z.string(),
  FAL_KEY: z.string(),
});

const config = configSchema.parse(process.env);

export { config };