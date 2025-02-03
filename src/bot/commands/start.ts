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
    
    await ctx.reply(`Welcome! You have ${user.stars} ⭐`);
    logger.info({ telegramId }, 'Welcome message sent');
  } catch (error) {
    logger.error('Error in start command:', error);
    await ctx.reply('Sorry, something went wrong while processing your request.');
  }
});

export default composer;