import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { logger } from '../../lib/logger.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const composer = new Composer<BotContext>();

composer.command('balance', async (ctx) => {
  try {
    if (!ctx.from?.id) {
      logger.warn('No from field in context');
      await ctx.reply('Could not identify user');
      return;
    }

    const telegramId = ctx.from.id.toString();
    logger.info({ telegramId }, 'Balance command received');

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: {
        stars: true,
        totalSpentStars: true,
        totalBoughtStars: true
      }
    });
    
    if (!user) {
      logger.warn({ telegramId }, 'User not found in database');
      await ctx.reply('You need to use /start first to create your account!');
      return;
    }

    const message = `💫 *Your Stars Balance*
    
Current Balance: ${user.stars ?? 0} ⭐
Total Bought: ${user.totalBoughtStars ?? 0} ⭐
Total Spent: ${user.totalSpentStars ?? 0} ⭐

Use /stars to buy more stars for generating images!`;

    logger.info({ 
      telegramId, 
      stars: user.stars,
      totalBought: user.totalBoughtStars,
      totalSpent: user.totalSpentStars
    }, 'Balance info sent');

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error({ error }, 'Failed to check balance');
    await ctx.reply('Sorry, something went wrong while checking your balance. Please try again.');
  }
});

export default composer;