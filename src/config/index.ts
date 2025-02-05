/**
 * App configuration
 */
export const config = {
  PORT: process.env.PORT || 3001,
  NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'production',
  MINIAPP_URL: process.env.MINIAPP_URL,
  PUBLIC_URL: process.env.PUBLIC_URL || 'https://selfi-dev.blackiris.art',

  /**
   * Telegram bot configuration
   */
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_PROVIDER_TOKEN: process.env.TELEGRAM_PROVIDER_TOKEN,

  /**
   * FAL AI configuration
   */
  FAL_KEY: process.env.FAL_KEY || '',
  FAL_KEY_SECRET: process.env.FAL_KEY_SECRET,

  /**
   * Database configuration
   */
  DATABASE_URL: process.env.DATABASE_URL || '',

  /**
   * Storage configuration
   */
  SPACES_KEY: process.env.SPACES_KEY || '',
  SPACES_SECRET: process.env.SPACES_SECRET || '',
  SPACES_ENDPOINT: process.env.SPACES_ENDPOINT,
  SPACES_BUCKET: process.env.SPACES_BUCKET,

  /**
   * Cost configuration
   */
  IMAGE_COST: 1,
  TRAINING_BASE_COST: 100,

  /**
   * Training configuration
   */
  DEFAULT_TRAINING_STEPS: 600,
  MIN_TRAINING_STEPS: 100,
  MAX_TRAINING_STEPS: 1200,
  DEFAULT_LEARNING_RATE: 0.0001,

  /**
   * Image generation configuration
   */
  DEFAULT_BASE_MODEL: 'fal-ai/flux-lora',
  DEFAULT_NEGATIVE_PROMPT: '',
} as const;