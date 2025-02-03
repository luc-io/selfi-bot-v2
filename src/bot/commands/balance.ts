import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { Ids } from '../../types/ids.js';

const composer = new Composer<BotContext>();

/**
 * /balance command - Show user's current star balance
 */
composer.command('balance', async (ctx) => {
  try {
    if (!ctx.from?.id) {
      await ctx.reply('Could not identify user');
      return;
    }

    const telegramId = Ids.telegram(ctx.from.id.toString());

    const user = await prisma.user.findUnique({
      where: { telegramId }
    });
    
    if (!user) {
      await ctx.reply('You need to use /start first to create your account.');
      return;
    }

    await ctx.reply(`⭐ Your balance: ${user.stars} stars\n\nUse /stars to buy more stars for generating images!`);
  } catch (error) {
    logger.error({ 
      error, 
      telegramId: ctx.from?.id.toString() 
    }, 'Failed to check balance');
    await ctx.reply('Sorry, something went wrong while checking your balance.');
  }
});

export default composer;