import { Bot } from 'grammy';
import { BotContext } from '../types/bot.js';
import { config } from '../config.js';
import { logger } from './logger.js';

export async function notifyAdmin(
  bot: Bot<BotContext>,
  message: string
): Promise<void> {
  try {
    await bot.api.sendMessage(config.ADMIN_TELEGRAM_ID, message);
    logger.info({ message }, 'Admin notification sent');
  } catch (error) {
    logger.error({ error, message }, 'Failed to send admin notification');
  }
}

export async function notifyNewUser(
  bot: Bot<BotContext>,
  telegramId: string,
  username?: string
): Promise<void> {
  const message = `🆕 New user started the bot!\n\nTelegram ID: ${telegramId}\nUsername: ${username ? '@' + username : 'Not provided'}`;
  await notifyAdmin(bot, message);
}