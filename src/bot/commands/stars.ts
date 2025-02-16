import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { getOrCreateUser } from '../../lib/user.js';
import { logger } from '../../lib/logger.js';
import { StarsService } from '../../services/stars.js';
import { LabeledPrice } from '@grammyjs/types';

const composer = new Composer<BotContext>();

const starPacks = [
  [50, 50],     // 50 stars for 50 XTR
  [100, 100],   // 100 stars for 100 XTR
  [200, 200],   // 200 stars for 200 XTR
  [500, 500],   // 500 stars for 500 XTR
  [1000, 1000]  // 1000 stars for 1000 XTR
] as const;

composer.command(['estrellas', 'stars'], async (ctx) => {
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
  try {
    if (!ctx.chat?.id) {
      await ctx.answerCallbackQuery({ 
        text: 'Error: No se pudo identificar el chat',
        show_alert: true 
      });
      return;
    }

    const match = ctx.callbackQuery.data.match(/^buy_stars:(\d+)$/);
    if (!match) {
      await ctx.answerCallbackQuery({ text: 'Paquete de estrellas inválido' });
      return;
    }

    const stars = parseInt(match[1], 10);
    const price = starPacks.find(([s]) => s === stars)?.[1];

    if (!price) {
      await ctx.answerCallbackQuery({ text: 'Paquete de estrellas inválido' });
      return;
    }

    // Clear callback loading state
    await ctx.answerCallbackQuery();

    const prices: LabeledPrice[] = [{
      label: `${stars} Estrellas`,
      amount: price * 100 // in minimal units
    }];

    try {
      // Send invoice
      await ctx.api.sendInvoice(
        ctx.chat.id,
        `${stars} Estrellas Selfi`, // title
        `Compra ${stars} ⭐ para generar imágenes con IA`, // description
        `stars_${stars}`, // payload
        '', // provider_token (empty for Stars)
        'XTR', // currency
        prices
      );

      logger.info({ 
        userId: ctx.from.id,
        stars,
        price: price * 100
      }, 'Stars invoice sent');

    } catch (invoiceError) {
      logger.error({
        error: invoiceError,
        stars,
        price,
        userId: ctx.from.id
      }, 'Failed to send invoice');

      await ctx.reply(
        'Hubo un error al procesar tu solicitud.\n' +
        'Por favor intenta de nuevo en unos momentos.'
      );
    }
  } catch (error) {
    logger.error({
      error,
      userId: ctx.from?.id,
      data: ctx.callbackQuery.data
    }, 'Error in buy stars callback');

    await ctx.answerCallbackQuery({
      text: 'Lo sentimos, hubo un error. Por favor intenta de nuevo.',
      show_alert: true
    });
  }
});

export default composer;