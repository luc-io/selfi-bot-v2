import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { getOrCreateUser } from '../../lib/user.js';
import { logger } from '../../lib/logger.js';
import { StarsService } from '../../services/stars.js';

const composer = new Composer<BotContext>();

const starPacks = [
  [50, 50],     // 50 stars for 50 XTR
  [100, 100],   // 100 stars for 100 XTR
  [200, 200],   // 200 stars for 200 XTR
  [500, 500],   // 500 stars for 500 XTR
  [1000, 1000]  // 1000 stars for 1000 XTR
] as const;

composer.command('estrellas', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId || !ctx.from) {
    await ctx.reply('No se pudo identificar al usuario');
    return;
  }

  try {
    const balance = await StarsService.getBalance(telegramId);

    // Create keyboard with star packs
    const inlineKeyboard = {
      inline_keyboard: starPacks.map(([stars, price]) => ([
        { 
          text: `${stars} ⭐ - ${price} XTR`,
          callback_data: `buy_stars:${stars}`
        }
      ]))
    };

    await ctx.reply(
      `Tienes ${balance.stars} ⭐\n\n` +
      `Cada generación de imagen cuesta 3 ⭐\nCada entrenamiento cuesta 150 ⭐\n\nCompra más estrellas:`,
      { reply_markup: inlineKeyboard }
    );
  } catch (error) {
    logger.error({ error, telegramId }, 'Error in stars command');
    await ctx.reply('Lo sentimos, algo salió mal.');
  }
});

// Handle buy stars callbacks
composer.callbackQuery(/^buy_stars:(\d+)$/, async (ctx) => {
  const match = ctx.callbackQuery.data.match(/^buy_stars:(\d+)$/);
  if (!match) return;

  const stars = parseInt(match[1], 10);
  const price = starPacks.find(([s]) => s === stars)?.[1];

  if (!price) {
    await ctx.answerCallbackQuery({ text: 'Paquete de estrellas inválido' });
    return;
  }

  try {
    await ctx.answerCallbackQuery();

    // Send invoice with proper parameters for Telegram Stars
    await ctx.replyWithInvoice(
      `${stars} Estrellas Selfi`, // title
      `Compra ${stars} estrellas para generar imágenes y entrenar`, // description
      `stars_${stars}`, // payload
      'XTR', // currency
      [{ // prices array
        label: `${stars} Estrellas`,
        amount: price
      }],
      { // optional parameters
        provider_token: '', // Empty string for Stars payments
        start_parameter: `stars_${stars}`,
        provider_data: JSON.stringify({
          stars_amount: stars,
          type: 'stars_purchase'
        }),
        max_tip_amount: 0,
        suggested_tip_amounts: []
      }
    );
    
    logger.info({ 
      userId: ctx.from.id,
      stars,
      amount: price
    }, 'Stars invoice sent');
  } catch (error) {
    const err = error as Error;
    logger.error({
      error: err.message,
      stack: err.stack,
      stars,
      price,
      userId: ctx.from.id
    }, 'Failed to send stars invoice');
    
    await ctx.reply(
      'Lo sentimos, hubo un error al procesar tu solicitud de estrellas.\n' +
      'Por favor intenta de nuevo en unos momentos.'
    );
  }
});

export default composer;