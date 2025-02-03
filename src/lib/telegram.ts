import crypto from 'crypto';
import { config } from '../config.js';

export function validateTelegramWebAppData(initData: string): boolean {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) return false;

    // Remove hash from initData
    urlParams.delete('hash');

    // Sort parameters alphabetically
    const params = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Calculate HMAC-SHA256
    const secret = crypto.createHmac('sha256', 'WebAppData')
      .update(config.TELEGRAM_BOT_TOKEN)
      .digest();

    const calculatedHash = crypto.createHmac('sha256', secret)
      .update(params)
      .digest('hex');

    return calculatedHash === hash;
  } catch (error) {
    console.error('Error validating Telegram Web App data:', error);
    return false;
  }
}