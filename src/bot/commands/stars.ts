import { Bot, Context } from 'grammy';
import { logger } from '../../lib/logger.js';
import { StarsService } from '../../services/stars.js';

export function setupStarsCommands(bot: Bot) {
  // Handle /balance command
  bot.command('balance', async (ctx) => {
    try {
      const telegramId = ctx.from.id.toString();
      const stars = await StarsService.getBalance(telegramId);
      
      await ctx.reply(`Your current balance: ${stars} ⭐`);
    } catch (error) {
      logger.error({
        error,
        userId: ctx.from.id,
        command: 'balance'
      }, 'Error handling balance command');
      
      await ctx.reply('Sorry, there was an error checking your balance. Please try again.');
    }
  });

  // Handle pre-checkout query
  bot.on('pre_checkout_query', async (ctx) => {
    try {
      const telegramId = ctx.from.id.toString();
      const stars = ctx.preCheckoutQuery.total_amount; // The amount in lowest currency unit

      logger.info({ 
        userId: ctx.from.id,
        stars,
        amount: stars
      }, 'Pre-checkout approved');

      const canProceed = await StarsService.validatePreCheckout(telegramId, stars);

      if (canProceed) {
        await ctx.answerPreCheckoutQuery(true);
      } else {
        await ctx.answerPreCheckoutQuery(false, 'Sorry, something went wrong. Please try again.');
      }
    } catch (error) {
      logger.error({
        error,
        userId: ctx.from.id
      }, 'Error handling pre-checkout');
      
      await ctx.answerPreCheckoutQuery(false, 'An error occurred. Please try again later.');
    }
  });

  // Handle successful payment
  bot.on('message:successful_payment', async (ctx) => {
    try {
      const telegramId = ctx.from.id.toString();
      const payment = ctx.message.successful_payment;
      
      const stars = payment.total_amount; // The amount in lowest currency unit
      const telegramPaymentChargeId = payment.telegram_payment_charge_id;

      const updatedUser = await StarsService.processPayment(
        telegramId,
        stars,
        telegramPaymentChargeId
      );

      await ctx.reply(`✨ Success! ${stars} stars have been added to your balance.\nCurrent balance: ${updatedUser.stars} ⭐`);

    } catch (error) {
      logger.error({
        error,
        userId: ctx.from.id
      }, 'Failed to process successful payment');

      await ctx.reply('There was an error processing your payment. Please contact support with your payment ID.');
    }
  });
}