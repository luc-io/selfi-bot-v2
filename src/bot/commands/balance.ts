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
      await ctx.reply('No se pudo identificar al usuario');
      return;
    }

    const telegramId = ctx.from.id.toString();
    logger.info({ telegramId }, 'Comando Balance recibido');

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: {
        stars: true,
        totalSpentStars: true,
        totalBoughtStars: true
      }
    });
    
    if (!user) {
      logger.warn({ telegramId }, 'El usuario no se encuentra en la base de datos');
      await ctx.reply('Usa /Inicio para iniciar el bot!');
      return;
    }

    const message = `💫 *To balance de estrellas*
    
Balance actual: ${user.stars ?? 0} ⭐

Usa /estrellas para comprar más ⭐ para generar imágenes o entrenar un modelo !`;

    logger.info({ 
      telegramId, 
      stars: user.stars,
      totalBought: user.totalBoughtStars,
      totalSpent: user.totalSpentStars
    }, 'Balance info sent');

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error({ error }, 'Error al consultar el balance');
    await ctx.reply('Disculpa, algo salió mal al consultar su balance. Intentalo nuevamente.');
  }
});

export default composer;
