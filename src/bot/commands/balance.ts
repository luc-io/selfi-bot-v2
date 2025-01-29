import { Context } from 'grammy';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';

export async function balanceHandler(ctx: Context) {
  try {
    const telegramId = ctx.from?.id.toString();

    if (!telegramId) {
      await ctx.reply('Error: Could not identify user');
      return;
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: {
        stars: true,
        totalSpentStars: true,
        totalBoughtStars: true,
        _count: {
          select: {
            generations: true,
            models: true
          }
        }
      }
    });

    if (!user) {
      await ctx.reply('Please start the bot with /start first');
      return;
    }

    // Format message
    const message = [
      `💫 Your Stars Balance`,
      ``,
      `⭐ Current balance: ${user.stars} stars`,
      `🔄 Total spent: ${user.totalSpentStars} stars`,
      `💰 Total purchased: ${user.totalBoughtStars} stars`,
      ``,
      `📊 Statistics`,
      `🎨 Images generated: ${user._count.generations}`,
      `🎯 Models trained: ${user._count.models}`,
      ``,
      `Get more stars:`,
      `• Generate images (2⭐ each)`,
      `• Train models (150⭐ each)`,
      `• Buy stars using /stars command`
    ].join('\n');

    await ctx.reply(message);

  } catch (error) {
    logger.error('Error in balance command:', error);
    await ctx.reply('Sorry, something went wrong. Please try again later.');
  }
}