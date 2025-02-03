import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { getOrCreateUser } from '../../lib/user.js';
import { logger } from '../../lib/logger.js';

const composer = new Composer<BotContext>();

composer.command('start', async (ctx) => {
  logger.info('Start command received');
  
  if (!ctx.from) {
    logger.warn('No from field in context');
    await ctx.reply('Could not identify user');
    return;
  }

  try {
    const telegramId = ctx.from.id.toString();
    logger.info({ telegramId, username: ctx.from.username }, 'Getting or creating user');
    
    const user = await getOrCreateUser(telegramId, ctx.from.username ?? undefined);
    logger.info({ telegramId, stars: user.stars }, 'User retrieved/created');
    
    const username = ctx.from.username ? `@${ctx.from.username}` : 'there';
    const message = `👋 Welcome ${username}!

You have ${user.stars} ⭐

🌟 Here's what I can do for you:

/gen - Generate a new image with AI
/stars - Buy stars (currency for generations)
/balance - Check your stars balance
/help - Show all available commands

Each image generation costs 1 star. Get started with the /stars command to purchase some stars!`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
    logger.info({ telegramId }, 'Welcome message sent');
  } catch (error) {
    logger.error('Error in start command:', error);
    await ctx.reply('Sorry, something went wrong while processing your request.');
  }
});

export default composer;