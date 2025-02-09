import { Api, RawApi } from 'grammy';
import { BotContext } from '../types/bot.js';
import { config } from '../config.js';
import { logger } from './logger.js';

export async function notifyAdmin(
  api: Api<RawApi>,
  message: string
): Promise<void> {
  // Skip if no admin ID is configured
  if (!config.ADMIN_TELEGRAM_ID) {
    logger.info('No admin Telegram ID configured, skipping notification');
    return;
  }

  try {
    await api.sendMessage(config.ADMIN_TELEGRAM_ID!, message);
    logger.info({ message }, 'Admin notification sent');
  } catch (error) {
    logger.error({ error, message }, 'Failed to send admin notification');
  }
}

export async function notifyNewUser(
  api: Api<RawApi>,
  telegramId: string,
  userInfo: {
    username?: string;
    firstName?: string;
    lastName?: string;
  }
): Promise<void> {
  const fullName = [userInfo.firstName, userInfo.lastName]
    .filter(Boolean)
    .join(' ');
  
  const message = `🆕 New user started the bot!\n\n` +
    `Telegram ID: ${telegramId}\n` +
    `${fullName ? `Name: ${fullName}\n` : ''}` +
    `Username: ${userInfo.username ? '@' + userInfo.username : 'Not provided'}`;
    
  await notifyAdmin(api, message);
}