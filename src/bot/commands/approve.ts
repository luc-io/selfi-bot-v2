import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { config } from '../../config.js';

const composer = new Composer<BotContext>();

composer.command('approve', async (ctx) => {
  if (!ctx.from) {
    logger.warn('No from field in context');
    await ctx.reply('Could not identify user');
    return;
  }

  // Check if admin ID is configured and if command user is admin
  if (!config.ADMIN_TELEGRAM_ID || ctx.from.id.toString() !== config.ADMIN_TELEGRAM_ID.toString()) {
    logger.warn({
      telegramId: ctx.from.id.toString(),
      command: 'approve'
    }, 'Non-admin tried to use approve command');
    return;
  }

  try {
    const args = ctx.match.split(' ');
    const targetTelegramId = args[0];

    if (!targetTelegramId) {
      await ctx.reply('Please provide a user ID to approve.\n\nUsage: /approve <telegram_id>');
      return;
    }

    // Find and update user status
    const user = await prisma.user.findUnique({
      where: { telegramId: targetTelegramId }
    });

    if (!user) {
      await ctx.reply('User not found.');
      return;
    }

    if (user.status === 'APPROVED') {
      await ctx.reply('This user is already approved.');
      return;
    }

    // Update user status and grant welcome bonus
    await prisma.$transaction([
      // Update user status and add welcome bonus
      prisma.user.update({
        where: { telegramId: targetTelegramId },
        data: {
          status: 'APPROVED',
          stars: { increment: 10 }
        }
      }),
      // Create welcome bonus transaction
      prisma.starTransaction.create({
        data: {
          user: { connect: { telegramId: targetTelegramId } },
          amount: 10,
          type: 'ADMIN_GRANT',
          metadata: {
            reason: 'Welcome bonus'
          }
        }
      })
    ]);

    // Notify the approved user
    await ctx.api.sendMessage(
      targetTelegramId,
      '🎉 <b>Welcome to Selfi!</b>\n\n' +
      'Your access has been approved and you\'ve received 10 ⭐ welcome bonus stars!\n\n' +
      'Use /help to see all available commands.',
      { parse_mode: 'HTML' }
    );

    // Confirm to admin
    await ctx.reply(`User ${targetTelegramId} has been approved and received welcome bonus.`);

    logger.info({ approvedTelegramId: targetTelegramId }, 'User approved and welcome bonus granted');
  } catch (error) {
    logger.error({
      err: error,
      command: 'approve'
    }, 'Error in approve command');
    
    await ctx.reply('Sorry, something went wrong while processing the approval.');
  }
});

export default composer;