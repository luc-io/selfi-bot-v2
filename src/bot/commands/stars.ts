import { Context } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { logger } from '../../lib/logger';
import { STAR_PRODUCTS, createStarInvoice } from '../../lib/payments';
import { getOrCreateUser } from '../../lib/user';

// Command handler for /stars
export async function starsHandler(ctx: Context) {
  try {
    if (!ctx.from?.id) {
      await ctx.reply('Could not identify user');
      return;
    }

    // Get user
    const user = await getOrCreateUser(ctx.from.id.toString(), ctx.from.username);

    // Create keyboard with product buttons
    const keyboard = new InlineKeyboard();
    STAR_PRODUCTS.forEach((product) => {
      keyboard.add({
        text: product.description,
        callback_data: `buy_stars:${product.id}`
      });
    });
    keyboard.row();
    keyboard.add({
      text: '💫 Check Balance',
      callback_data: 'check_stars'
    });

    // Send message with keyboard
    await ctx.reply(
      `🌟 Get more stars to generate images and train models!\n\n` +
      `Current balance: ${user.stars} ⭐\n\n` +
      `Select a package to continue:`,
      { reply_markup: keyboard }
    );
  } catch (error) {
    logger.error('Error in stars command:', error);
    await ctx.reply('Sorry, something went wrong. Please try again.');
  }
}

// Handle buy stars callback
export async function handleBuyStarsCallback(ctx: Context) {
  try {
    const callbackData = ctx.callbackQuery?.data;
    if (!callbackData?.startsWith('buy_stars:')) return;

    const productId = callbackData.replace('buy_stars:', '');
    const invoice = createStarInvoice(productId);

    await ctx.answerCallbackQuery();
    await ctx.replyWithInvoice(invoice);
  } catch (error) {
    logger.error('Error in buy stars callback:', error);
    await ctx.answerCallbackQuery({
      text: 'Sorry, something went wrong. Please try again.',
      show_alert: true
    });
  }
}

// Handle check stars callback
export async function handleCheckStarsCallback(ctx: Context) {
  try {
    if (!ctx.from?.id) {
      await ctx.answerCallbackQuery({
        text: 'Could not identify user',
        show_alert: true
      });
      return;
    }

    // Get user
    const user = await getOrCreateUser(ctx.from.id.toString(), ctx.from.username);

    // Show balance
    await ctx.answerCallbackQuery({
      text: `Current balance: ${user.stars} ⭐\nTotal spent: ${user.totalSpentStars} ⭐`,
      show_alert: true
    });
  } catch (error) {
    logger.error('Error in check stars callback:', error);
    await ctx.answerCallbackQuery({
      text: 'Sorry, something went wrong. Please try again.',
      show_alert: true
    });
  }
}