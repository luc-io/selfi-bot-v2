import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { config } from '../../config.js';

const composer = new Composer<BotContext>();

composer.command('approve', async (ctx) => {
  if (!ctx.from) {
    logger.warn('No from field in context');
    await ctx.reply('No se pudo identificar al usuario');
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
      await ctx.reply('Por favor proporciona un ID de usuario para aprobar.\n\nUso: /approve <telegram_id>');
      return;
    }

    // Find and update user status
    const user = await prisma.user.findUnique({
      where: { telegramId: targetTelegramId }
    });

    if (!user) {
      await ctx.reply('Usuario no encontrado.');
      return;
    }

    if (user.status === 'APPROVED') {
      await ctx.reply('Este usuario ya está aprobado.');
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
          amount: 12,
          type: 'ADMIN_GRANT',
          metadata: {
            reason: 'Bono de bienvenida'
          }
        }
      })
    ]);

    // Notify the approved user
    await ctx.api.sendMessage(
      targetTelegramId,
      '🎉 <b>¡Bienvenido a Selfi!</b>\n\n' +
      'Tu acceso ha sido aprobado y has recibido 12 ⭐ estrellas de bienvenida!\n\n' +
      'Usa /ayuda para ver todos los comandos disponibles.',
      { parse_mode: 'HTML' }
    );

    // Confirm to admin
    await ctx.reply(`Usuario ${targetTelegramId} ha sido aprobado y ha recibido el bono de bienvenida.`);

    logger.info({ approvedTelegramId: targetTelegramId }, 'User approved and welcome bonus granted');
  } catch (error) {
    logger.error({
      err: error,
      command: 'approve'
    }, 'Error in approve command');
    
    await ctx.reply('Lo sentimos, algo salió mal mientras procesábamos la aprobación.');
  }
});

export default composer;
