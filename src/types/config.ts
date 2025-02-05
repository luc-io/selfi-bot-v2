export interface Config {
  // App configuration
  PORT: string | number;
  NODE_ENV?: 'development' | 'production';
  MINIAPP_URL?: string;
  PUBLIC_URL?: string;

  // Telegram configuration
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_PROVIDER_TOKEN?: string;

  // FAL AI configuration
  FAL_KEY: string;
  FAL_KEY_SECRET?: string;

  // Database configuration
  DATABASE_URL: string;

  // Storage configuration
  SPACES_KEY: string;
  SPACES_SECRET: string;
  SPACES_ENDPOINT?: string;
  SPACES_BUCKET?: string;

  // Cost configuration
  IMAGE_COST: number;
  TRAINING_BASE_COST: number;

  // Training configuration
  DEFAULT_TRAINING_STEPS: number;
  MIN_TRAINING_STEPS: number;
  MAX_TRAINING_STEPS: number;
  DEFAULT_LEARNING_RATE: number;

  // Generation configuration
  DEFAULT_BASE_MODEL: string;
  DEFAULT_NEGATIVE_PROMPT: string;
}