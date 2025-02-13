import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { notifyAdmin } from '../../lib/admin.js';

const composer = new Composer<BotContext>();

composer.command('request', async (ctx) => {
  if (!ctx.from) {
    logger.warn('No from field in context');
    await ctx.reply('No se pudo identificar al usuario');
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
      await ctx.reply('Por favor inicia el bot con /start primero.');
      return;
    }

    if (user.status === 'APPROVED') {
      await ctx.reply('¡Ya estás aprobado para usar Selfi! 🎉\n\nUsa /help para ver los comandos disponibles.');
      return;
    }

    // Notify admin about the access request
    const requestMessage = `🔐 Solicitud de Acceso:\n\n` +
      `Usuario: ${ctx.from.username ? '@' + ctx.from.username : ctx.from.first_name}\n` +
      `ID: ${telegramId}\n\n` +
      `Para aprobar, usa:\n` +
      `/approve ${telegramId}`;

    await notifyAdmin(ctx.api, requestMessage);
    
    // Confirm to user
    await ctx.reply(
      '✨ ¡Tu solicitud de acceso ha sido enviada!\n\n' +
      'Serás notificado una vez que seas aprobado. ¡Gracias por tu interés en Selfi!'
    );

    logger.info({ telegramId }, 'Access request sent to admin');
  } catch (error) {
    logger.error({
      err: error,
      telegramId: ctx.from.id.toString(),
      command: 'request'
    }, 'Error in request command');
    
    await ctx.reply('Lo sentimos, algo salió mal mientras procesábamos tu solicitud.');
  }
});

export default composer;