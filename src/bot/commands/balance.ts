import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { logger } from '../../lib/logger.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const composer = new Composer<BotContext>();

composer.command('balance', async (ctx) => {
  try {
    if (!ctx.from?.id) {
      await ctx.reply('Could not identify user');
      return;
    }

    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from.id.toString() }
    });
    
    if (!user) {
      await ctx.reply('You need to use /start first to create your account.');
      return;
    }

    await ctx.reply(`⭐ Your balance: ${user.stars} stars\n\nUse /stars to buy more stars for generating images!`);
  } catch (error) {
    logger.error({ error }, 'Failed to check balance');
    await ctx.reply('Sorry, something went wrong while checking your balance.');
  }
});

export default composer;