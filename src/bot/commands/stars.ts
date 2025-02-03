import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { getOrCreateUser } from '../../lib/user.js';
import { logger } from '../../lib/logger.js';

const composer = new Composer<BotContext>();

composer.command('stars', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId || !ctx.from) {
    await ctx.reply('Could not identify user');
    return;
  }

  try {
    const user = await getOrCreateUser(telegramId, ctx.from?.username ?? undefined);

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { 
            text: '5 ⭐ - 5 XTR',
            callback_data: 'buy_stars:5'
          },
          {
            text: '20 ⭐ - 20 XTR',
            callback_data: 'buy_stars:20'
          }
        ],
        [
          {
            text: '50 ⭐ - 50 XTR',
            callback_data: 'buy_stars:50'
          },
          {
            text: '100 ⭐ - 100 XTR',
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
    5: 5,     // 5 XTR
    20: 20,   // 20 XTR
    50: 50,   // 50 XTR
    100: 100  // 100 XTR
  };

  const price = prices[stars as keyof typeof prices];
  if (!price) return;

  try {
    const prices = [{
      label: `${stars} Stars`,
      amount: price
    }];

    await ctx.answerCallbackQuery();
    await ctx.replyWithInvoice(
      `${stars} Selfi Stars`, // title
      `Purchase ${stars} stars for image generation`, // description
      `stars_${stars}`, // payload
      'XTR', // currency
      prices // prices
    );
    
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