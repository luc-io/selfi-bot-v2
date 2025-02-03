import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { getOrCreateUser } from '../../lib/user.js';
import { logger } from '../../lib/logger.js';

const composer = new Composer<BotContext>();

composer.command('stars', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) {
    await ctx.reply('Could not identify user');
    return;
  }

  try {
    const user = await getOrCreateUser(telegramId, ctx.from.username ?? undefined);

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { 
            text: '5 ⭐ - $0.99',
            callback_data: 'buy_stars:5'
          },
          {
            text: '20 ⭐ - $2.99',
            callback_data: 'buy_stars:20'
          }
        ],
        [
          {
            text: '50 ⭐ - $4.99',
            callback_data: 'buy_stars:50'
          },
          {
            text: '100 ⭐ - $7.99',
            callback_data: 'buy_stars:100'
          }
        ]
      ]
    };

    await ctx.reply(
      `You have ${user.stars} ⭐\n\nEach image generation costs 1 ⭐\nBuy more stars:`,
      { reply_markup: inlineKeyboard }
    );
  } catch (error) {
    logger.error({ error, telegramId }, 'Error in stars command');
    await ctx.reply('Sorry, something went wrong.');
  }
});

// Handle buy stars callbacks
composer.callbackQuery(/^buy_stars:(\d+)$/, async (ctx) => {
  const match = ctx.callbackQuery.data.match(/^buy_stars:(\d+)$/);
  if (!match) return;

  const stars = parseInt(match[1], 10);
  const prices = {
    5: 0.99,
    20: 2.99,
    50: 4.99,
    100: 7.99
  };

  const price = prices[stars as keyof typeof prices];
  if (!price) return;

  try {
    const invoice = {
      title: `${stars} Selfi Stars`,
      description: `Purchase ${stars} stars for image generation`,
      currency: 'XTR',
      prices: [{ label: `${stars} Stars`, amount: Math.round(stars * 100) }],
      payload: `stars_${stars}`
    };

    await ctx.answerCallbackQuery();
    await ctx.reply(`Preparing payment for ${stars} stars...`);
    await ctx.replyWithInvoice(invoice);
    
    logger.info({ 
      userId: ctx.from.id,
      stars,
      amount: price
    }, 'Invoice sent');
  } catch (error) {
    logger.error({ error }, 'Failed to send invoice');
    await ctx.reply('Sorry, there was an error processing your request.');
  }
});

export default composer;