import { Context, NarrowedContext } from 'telegraf';
import { Message, Update } from 'telegraf/types';
import { prisma } from '../../db';
import { config } from '../../config';
import { PrismaClient, TransactionType } from '@prisma/client';

type MessageContext = NarrowedContext<Context<Update>, Update.MessageUpdate>;

export async function grantCommand(ctx: MessageContext) {
  try {
    // Check if sender is admin
    const senderId = ctx.message?.from?.id;
    if (!senderId || senderId.toString() !== config.ADMIN_TELEGRAM_ID?.toString()) {
      await ctx.reply('⛔️ This command is only available for administrators.');
      return;
    }

    // Parse command arguments
    const message = ctx.message as Message.TextMessage;
    const args = message.text.split(' ');
    
    if (args.length !== 3) {
      await ctx.reply('❌ Usage: /grant <telegramId> <amount>');
      return;
    }

    const targetTelegramId = args[1];
    const amount = parseInt(args[2]);

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
    await prisma.$transaction(async (tx: PrismaClient) => {
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
      await ctx.telegram.sendMessage(
        parseInt(targetTelegramId),
        `🎁 You received ${amount} stars from admin!`
      );
    } catch (error) {
      await ctx.reply('Note: Could not send notification to user (they might have blocked the bot)');
    }
  } catch (error) {
    console.error('Grant command error:', error);
    await ctx.reply('❌ An error occurred while processing the command');
  }
}