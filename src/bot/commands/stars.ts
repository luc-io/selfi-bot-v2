import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { logger } from '../../lib/logger.js';
import { createPayment } from '../../lib/payments.js';

const composer = new Composer<BotContext>();

// Show available star packs
composer.command('stars', async (ctx) => {
  try {
    const starPacks = [
      { stars: 5, price: 5, label: '5 ⭐' },
      { stars: 10, price: 10, label: '10 ⭐' },
      { stars: 20, price: 20, label: '20 ⭐' },
      { stars: 50, price: 50, label: '50 ⭐' },
    ];

    const buttons = starPacks.map((pack) => [
      {
        text: `${pack.label} - ${pack.price} XTR`,
        callback_data: `buy_stars:${pack.stars}:${pack.price}`,
      },
    ]);

    await ctx.reply('💫 Buy Stars\n\nStars are used for generating images. Each generation costs 1 star.', {
      reply_markup: {
        inline_keyboard: buttons,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to show star packs');
  }
});

// Handle star pack selection
composer.callbackQuery(/buy_stars:(\d+):(\d+)/, async (ctx) => {
  try {
    if (!ctx.match || !Array.isArray(ctx.match)) {
      await ctx.answerCallbackQuery('Invalid selection');
      return;
    }

    const stars = Number(ctx.match[1]);
    const price = Number(ctx.match[2]);

    const invoice = {
      title: `${stars} Stars Package`,
      description: `Buy ${stars} stars for generating images with Selfi`,
      payload: `stars_${stars}_${ctx.from?.id}`,
      currency: 'XTR',
      prices: [{ label: `${stars} Stars`, amount: price }],
    };

    await ctx.replyWithInvoice(
      invoice.title,
      invoice.description,
      invoice.payload,
      invoice.currency,
      invoice.prices
    );

    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.error({ error }, 'Failed to create invoice');
    await ctx.answerCallbackQuery('Failed to create invoice');
  }
});

// Handle successful payment
composer.on(':successful_payment', async (ctx) => {
  try {
    const payment = ctx.message?.successful_payment;
    if (!payment) return;

    const [_, stars, userId] = payment.invoice_payload.split('_');
    const amount = payment.total_amount;

    await createPayment({
      userId,
      amount,
      stars: Number(stars),
      telegramPaymentChargeId: payment.provider_payment_charge_id,
    });

    await ctx.reply(`✨ Thank you! ${stars} stars have been added to your balance.`);
  } catch (error) {
    logger.error({ error }, 'Failed to process successful payment');
  }
});

export default composer;