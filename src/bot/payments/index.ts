import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { updateUserStars } from '../../lib/user.js';
import { logger } from '../../lib/logger.js';

const composer = new Composer<BotContext>();

// Handle pre-checkout queries
composer.on('pre_checkout_query', async (ctx) => {
  if (!ctx.from || !ctx.preCheckoutQuery) return;
  
  const telegramId = ctx.from.id.toString();
  const query = ctx.preCheckoutQuery;

  try {
    const [starsType, amount] = query.invoice_payload.split('_');
    if (starsType !== 'stars') {
      await ctx.answerPreCheckoutQuery(false, {
        error_message: 'Invalid purchase type'
      });
      return;
    }

    const stars = parseInt(amount, 10);
    if (isNaN(stars) || stars <= 0) {
      await ctx.answerPreCheckoutQuery(false, {
        error_message: 'Invalid stars amount'
      });
      return;
    }

    logger.info({
      userId: telegramId,
      stars,
      amount: query.total_amount,
    }, 'Pre-checkout approved');

    await ctx.answerPreCheckoutQuery(true);
  } catch (error) {
    logger.error({ error }, 'Failed to process pre-checkout');
    await ctx.answerPreCheckoutQuery(false, {
      error_message: 'Something went wrong. Please try again.'
    });
  }
});

// Handle successful payments
composer.on('message:successful_payment', async (ctx) => {
  if (!ctx.from || !ctx.message?.successful_payment) return;
  
  const telegramId = ctx.from.id.toString();
  const payment = ctx.message.successful_payment;

  try {
    const [starsType, amount] = payment.invoice_payload.split('_');
    if (starsType !== 'stars') {
      logger.error({
        userId: telegramId,
        payload: payment.invoice_payload,
      }, 'Invalid payment type');
      return;
    }

    const stars = parseInt(amount, 10);
    if (isNaN(stars) || stars <= 0) {
      logger.error({
        userId: telegramId,
        amount,
      }, 'Invalid stars amount in payment');
      return;
    }

    // Update user's stars balance
    const { user } = await updateUserStars(telegramId, stars, 'PURCHASE');

    await ctx.reply(
      `✅ Payment successful!\n\nAdded ${stars} ⭐ to your balance.\nNew balance: ${user.stars} ⭐`
    );

    logger.info({
      userId: telegramId,
      stars,
      newBalance: user.stars,
      paymentId: payment.telegram_payment_charge_id,
    }, 'Payment processed successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to process successful payment');
    await ctx.reply(
      'Your payment was successful, but there was an error updating your balance. Please contact support with your payment ID.'
    );
  }
});

export default composer;