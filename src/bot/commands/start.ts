import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { getOrCreateUser } from '../../lib/user.js';
import { logger } from '../../lib/logger.js';
import { notifyNewUser } from '../../lib/admin.js';

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
    
    // If this is a new user, notify admin
    if (user.createdAt.getTime() === user.updatedAt.getTime()) {
      await notifyNewUser(ctx.api, telegramId, ctx.from.username ?? undefined);
    }
    
    const username = ctx.from.username ? `@${ctx.from.username}` : 'there';
    const message = `👋 Welcome ${username}!\n\nYou have ${user.stars} ⭐\n\n🌟 Here's what I can do for you:\n\n/gen - Generate a new image with AI\n/stars - Buy stars (currency for generations)\n/balance - Check your stars balance\n/help - Show all available commands\n\nEach image generation costs 1 star. Get started with the /stars command to purchase some stars!`;

    await ctx.reply(message);
    logger.info({ telegramId }, 'Welcome message sent');
  } catch (error) {
    logger.error({
      err: error,
      telegramId: ctx.from.id.toString(),
      command: 'start'
    }, 'Error in start command');
    
    await ctx.reply('Sorry, something went wrong while processing your request.');
  }
});

export default composer;