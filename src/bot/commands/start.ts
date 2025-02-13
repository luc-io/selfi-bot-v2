import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { getOrCreateUser } from '../../lib/user.js';
import { logger } from '../../lib/logger.js';
import { notifyNewUser } from '../../lib/admin.js';
import { config } from '../../config.js';

const composer = new Composer<BotContext>();

composer.command('inicio', async (ctx) => {
  logger.info({
    config: {
      adminId: config.ADMIN_TELEGRAM_ID,
      nodeEnv: config.NODE_ENV,
      publicUrl: config.PUBLIC_URL
    },
    from: ctx.from
  }, 'Start command received with full config');
  
  if (!ctx.from) {
    logger.warn('No from field in context');
    await ctx.reply('No se pudo identificar al usuario');
    return;
  }

  try {
    const telegramId = ctx.from.id.toString();
    logger.info({ telegramId, username: ctx.from.username }, 'Getting or creating user');
    
    const user = await getOrCreateUser(telegramId, ctx.from.username ?? undefined);
    logger.info({ 
      telegramId, 
      stars: user.stars,
      status: user.status,
      isNewUser: user.createdAt.getTime() === user.updatedAt.getTime(),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }, 'User retrieved/created');
    
    // If this is a new user, notify admin
    if (user.createdAt.getTime() === user.updatedAt.getTime()) {
      logger.info({ 
        telegramId, 
        adminId: config.ADMIN_TELEGRAM_ID,
        botInfo: ctx.me
      }, 'Attempting to notify admin about new user');
      await notifyNewUser(ctx.api, telegramId, {
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name
      });
      logger.info('Admin notification sent successfully');
    }
    
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name || 'there';

    // Different welcome messages based on user status
    if (user.status === 'PENDING') {
      const message = `🎨 <b>¡Bienvenido ${username}!</b>\n\n` +
        `Selfi está actualmente en alfa cerrada. Para unirte:\n\n` +
        `1. Usa /request para solicitar acceso\n` +
        `2. Espera la aprobación del administrador\n\n` +
        `Una vez aprobado, ¡tendrás acceso a todas las funciones y recibirás estrellas de bienvenida! ✨`;
      
      await ctx.reply(message, { parse_mode: 'HTML' });
      logger.info({ telegramId }, 'Closed alpha welcome message sent');
    } else {
      const message = `🎨 <b>¡Bienvenido ${username}!</b>\n\n` +
        `Actualmente tienes <b>${user.stars} ⭐ estrellas</b>\n\n` +
        `✨ <b>Comandos Disponibles:</b>\n` +
        `• /gen - Genera imágenes impresionantes con IA\n` +
        `• /estrellas - Obtén más estrellas\n` +
        `• /balance - Revisa tu saldo\n` +
        `• /ayuda - Ver todos los comandos\n\n` +
        `💫 <i>Cada generación de imagen cuesta 3 estrellas. ¡Usa /estrellas para comenzar!</i>\n\n` +
        `¿Necesitas ayuda? Usa /ayuda para aprender más sobre todas las funciones.`;

      await ctx.reply(message, { parse_mode: 'HTML' });
      logger.info({ telegramId }, 'Welcome message sent');
    }
  } catch (error) {
    logger.error({
      err: error,
      telegramId: ctx.from.id.toString(),
      command: 'inicio'
    }, 'Error in start command');
    
    await ctx.reply('Lo sentimos, algo salió mal mientras procesábamos tu solicitud.');
  }
});

export default composer;