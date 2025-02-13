import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { prisma } from '../../lib/prisma.js';
import { config } from '../../config.js';
import { TransactionType } from '@prisma/client';

const composer = new Composer<BotContext>();

composer.command('grant', async (ctx) => {
  try {
    // Check if sender is admin
    const senderId = ctx.from?.id;
    if (!senderId || senderId.toString() !== config.ADMIN_TELEGRAM_ID?.toString()) {
      await ctx.reply('⛔️ This command is only available for administrators.');
      return;
    }

    // Parse command arguments
    const args = ctx.msg.text.split(' ').slice(1); // Remove the command part
    
    if (args.length !== 2) {
      await ctx.reply('❌ Usage: /grant <telegramId> <amount>');
      return;
    }

    const [targetTelegramId, amountStr] = args;
    const amount = parseInt(amountStr);

    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('❌ Amount must be a positive number');
      return;
    }

    // Find target user
    const targetUser = await prisma.user.findUnique({
      where: { telegramId: targetTelegramId },
    });

    if (!targetUser) {
      await ctx.reply(`❌ User with Telegram ID ${targetTelegramId} not found`);
      return;
    }

    // Create transaction and update user stars in a transaction
    await prisma.$transaction(async (tx) => {
      // Create star transaction
      await tx.starTransaction.create({
        data: {
          userDatabaseId: targetUser.databaseId,
          amount: amount,
          type: TransactionType.ADMIN_GRANT,
          status: 'COMPLETED',
          metadata: {
            grantedBy: senderId,
            grantedAt: new Date().toISOString(),
          },
        },
      });

      // Update user stars
      await tx.user.update({
        where: { databaseId: targetUser.databaseId },
        data: {
          stars: { increment: amount },
          totalBoughtStars: { increment: amount },
        },
      });
    });

    // Send confirmation messages
    await ctx.reply(`✅ Granted ${amount} stars to user ${targetUser.username || targetTelegramId}`);
    
    try {
      await ctx.api.sendMessage(
        parseInt(targetTelegramId),
        `🎁 Recibiste ${amount} estrellas de regalo!`
      );
    } catch (error) {
      await ctx.reply('Note: Could not send notification to user (they might have blocked the bot)');
    }
  } catch (error) {
    console.error('Grant command error:', error);
    await ctx.reply('❌ An error occurred while processing the command');
  }
});

export default composer;
