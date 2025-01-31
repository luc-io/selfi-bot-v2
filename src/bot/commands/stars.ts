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

    // Create a unique start parameter
    const startParameter = `stars_${Date.now()}`;

    const invoice = {
      title: `${stars} Stars Package`,
      description: `Buy ${stars} stars for generating images with Selfi`,
      payload: `stars_${stars}_${ctx.from?.id}`,
      provider_token: '', // Empty for digital goods
      currency: 'XTR',
      prices: [{ label: `${stars} Stars`, amount: price }],
      start_parameter: startParameter,
      need_name: false,
      need_phone_number: false,
      need_email: false,
      need_shipping_address: false,
      is_flexible: false,
      photo_url: undefined,
      photo_size: undefined,
      photo_width: undefined,
      photo_height: undefined,
    };

    await ctx.replyWithInvoice(
      invoice.title,
      invoice.description,
      invoice.payload,
      invoice.provider_token,
      invoice.currency,
      invoice.prices,
      {
        start_parameter: invoice.start_parameter,
        need_name: invoice.need_name,
        need_phone_number: invoice.need_phone_number,
        need_email: invoice.need_email,
        need_shipping_address: invoice.need_shipping_address,
        is_flexible: invoice.is_flexible,
      }
    );

    await ctx.answerCallbackQuery();
  } catch (error) {
    logger.error({ error }, 'Failed to create invoice');
    await ctx.answerCallbackQuery('Failed to create invoice');
  }
});

// Handle pre-checkout query
composer.on('pre_checkout_query', async (ctx) => {
  try {
    const query = ctx.preCheckoutQuery;
    
    // Parse the payload to get stars and userId
    const [_, stars, userId] = query.invoice_payload.split('_');
    
    if (!stars || !userId) {
      await ctx.answerPreCheckoutQuery(false, 'Invalid payment data');
      return;
    }

    // Verify user exists
    const user = await ctx.api.getChat(Number(userId));
    if (!user) {
      await ctx.answerPreCheckoutQuery(false, 'User not found');
      return;
    }

    // Accept the transaction
    await ctx.answerPreCheckoutQuery(true);
    
    logger.info({
      userId,
      stars,
      amount: query.total_amount
    }, 'Pre-checkout approved');

  } catch (error) {
    logger.error({ error }, 'Pre-checkout query failed');
    await ctx.answerPreCheckoutQuery(false, 'Payment processing failed. Please try again.');
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

    logger.info({
      userId,
      stars,
      amount,
      chargeId: payment.provider_payment_charge_id
    }, 'Payment processed successfully');

    await ctx.reply(`✨ Thank you! ${stars} stars have been added to your balance.`);
  } catch (error) {
    logger.error({ error }, 'Failed to process successful payment');
    await ctx.reply('⚠️ There was an issue processing your payment. Please contact support if stars were not added to your balance.');
  }
});

export default composer;