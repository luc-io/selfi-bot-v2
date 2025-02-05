import dotenv from 'dotenv';
import type { Config } from '../types/config.js';

// Load environment variables
dotenv.config();

export const config: Config = {
  /**
   * App configuration
   */
  PORT: process.env.PORT || 3001,
  NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'production',
  PUBLIC_URL: process.env.PUBLIC_URL,
  MINIAPP_URL: process.env.MINIAPP_URL,
  
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
  IMAGE_COST: parseInt(process.env.IMAGE_COST || '1', 10),
  TRAINING_BASE_COST: parseInt(process.env.TRAINING_BASE_COST || '100', 10),

  /**
   * Training configuration
   */
  DEFAULT_TRAINING_STEPS: parseInt(process.env.DEFAULT_TRAINING_STEPS || '600', 10),
  MIN_TRAINING_STEPS: parseInt(process.env.MIN_TRAINING_STEPS || '100', 10),
  MAX_TRAINING_STEPS: parseInt(process.env.MAX_TRAINING_STEPS || '1200', 10),
  DEFAULT_LEARNING_RATE: parseFloat(process.env.DEFAULT_LEARNING_RATE || '0.0001'),

  /**
   * Image generation configuration
   */
  DEFAULT_BASE_MODEL: process.env.DEFAULT_BASE_MODEL || 'fal-ai/flux-lora',
  DEFAULT_NEGATIVE_PROMPT: process.env.DEFAULT_NEGATIVE_PROMPT || '',
};