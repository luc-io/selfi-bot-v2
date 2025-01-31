import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { logger } from '../../lib/logger.js';

const composer = new Composer<BotContext>();

composer.command('help', async (ctx) => {
  try {
    await ctx.reply(
      'Available commands:\n\n' +
      '/gen - Generate an image\n' +
      '/stars - Buy more stars\n' +
      '/balance - Check your stars balance\n' +
      '/help - Show this help message'
    );
  } catch (error) {
    logger.error({ error }, 'Failed to show help');
  }
});

export default composer;