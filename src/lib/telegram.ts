import { config } from '../config.js';
import { createHmac } from 'crypto';
import { logger } from './logger.js';

/**
 * Validates Telegram Web App init data
 * @param initData - Raw init data string from Telegram Web App
 * @returns boolean indicating if the data is valid
 */
export function validateTelegramWebAppData(initData: string): boolean {
  try {
    // Parse the init data
    const searchParams = new URLSearchParams(initData);
    const hash = searchParams.get('hash');
    searchParams.delete('hash');

    // Sort params alphabetically
    const params = Array.from(searchParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Calculate the hash
    const secret = createHmac('sha256', 'WebAppData')
      .update(config.TELEGRAM_BOT_TOKEN)
      .digest();

    const calculatedHash = createHmac('sha256', secret)
      .update(params)
      .digest('hex');

    // Compare hashes
    const valid = hash === calculatedHash;
    if (!valid) {
      logger.warn({
        hash,
        calculatedHash,
        params
      }, 'Invalid Telegram Web App init data');
    }
    
    return valid;
  } catch (error) {
    logger.error({ error }, 'Error validating Telegram Web App init data');
    return false;
  }
}