import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { getOrCreateUser } from '../../lib/user.js';
import { logger } from '../../lib/logger.js';
import { StarsService } from '../../services/stars.js';

const composer = new Composer<BotContext>();

const starPacks = [
  [20, 20],   // 20 stars for 20 XTR
  [50, 50],   // 50 stars for 50 XTR
  [100, 100], // 100 stars for 100 XTR
  [250, 250], // 250 stars for 250 XTR
  [500, 500], // 500 stars for 500 XTR
  [1000, 1000] // 1000 stars for 1000 XTR
] as const;

composer.command('stars', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId || !ctx.from) {
    await ctx.reply('Could not identify user');
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

    const recentTransactions = balance.starTransactions
      .map(t => `${t.type}: ${t.amount > 0 ? '+' : ''}${t.amount} ⭐`)
      .join('\n');

    await ctx.reply(
      `You have ${balance.stars} ⭐\n\n` +
      `Total spent: ${balance.totalSpentStars} ⭐\n` +
      `Total bought: ${balance.totalBoughtStars} ⭐\n\n` +
      `Recent transactions:\n${recentTransactions}\n\n` +
      `Each image generation costs 1 ⭐\nEach training costs 150 ⭐\n\nBuy more stars:`,
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
  const price = starPacks.find(([s]) => s === stars)?.[1];

  if (!price) {
    await ctx.answerCallbackQuery({ text: 'Invalid star pack selected' });
    return;
  }

  try {
    await ctx.answerCallbackQuery();
    await ctx.replyWithInvoice(
      `${stars} Selfi Stars`, // title
      `Purchase ${stars} stars for image generation and training`, // description
      `stars_${stars}`, // payload
      'XTR', // currency
      [{
        label: `${stars} Stars`,
        amount: price
      }] // prices
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