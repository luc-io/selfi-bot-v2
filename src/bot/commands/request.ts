import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { notifyAdmin } from '../../lib/admin.js';

const composer = new Composer<BotContext>();

composer.command('request', async (ctx) => {
  if (!ctx.from) {
    logger.warn('No from field in context');
    await ctx.reply('Could not identify user');
    return;
  }

  try {
    const telegramId = ctx.from.id.toString();
    
    // Check if user exists and get their status
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { status: true }
    });

    if (!user) {
      await ctx.reply('Please start the bot with /start first.');
      return;
    }

    if (user.status === 'APPROVED') {
      await ctx.reply('You are already approved to use Selfi! 🎉\n\nUse /help to see available commands.');
      return;
    }

    // Notify admin about the access request
    const requestMessage = `🔐 Access Request:\n\n` +
      `User: ${ctx.from.username ? '@' + ctx.from.username : ctx.from.first_name}\n` +
      `ID: ${telegramId}\n\n` +
      `To approve, use:\n` +
      `/approve ${telegramId}`;

    await notifyAdmin(ctx.api, requestMessage);
    
    // Confirm to user
    await ctx.reply(
      '✨ Your access request has been sent!\n\n' +
      'You will be notified once approved. Thank you for your interest in Selfi!'
    );

    logger.info({ telegramId }, 'Access request sent to admin');
  } catch (error) {
    logger.error({
      err: error,
      telegramId: ctx.from.id.toString(),
      command: 'request'
    }, 'Error in request command');
    
    await ctx.reply('Sorry, something went wrong while processing your request.');
  }
});

export default composer;