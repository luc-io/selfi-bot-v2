import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { getOrCreateUser } from '../../lib/user.js';
import { logger } from '../../lib/logger.js';
import { notifyNewUser } from '../../lib/admin.js';
import { config } from '../../config.js';

const composer = new Composer<BotContext>();

composer.command('start', async (ctx) => {
  logger.info({
    config: {
      adminId: config.ADMIN_TELEGRAM_ID,
      nodeEnv: config.NODE_ENV,
      publicUrl: config.PUBLIC_URL
    },
    from: ctx.from
  }, 'Start command received with full config');
  
  if (!ctx.from) {
    logger.warn('No from field in context');
    await ctx.reply('Could not identify user');
    return;
  }

  try {
    const telegramId = ctx.from.id.toString();
    logger.info({ telegramId, username: ctx.from.username }, 'Getting or creating user');
    
    const user = await getOrCreateUser(telegramId, ctx.from.username ?? undefined);
    logger.info({ 
      telegramId, 
      stars: user.stars,
      isNewUser: user.createdAt.getTime() === user.updatedAt.getTime(),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }, 'User retrieved/created');
    
    // If this is a new user, notify admin
    if (user.createdAt.getTime() === user.updatedAt.getTime()) {
      logger.info({ 
        telegramId, 
        adminId: config.ADMIN_TELEGRAM_ID,
        botInfo: ctx.me
      }, 'Attempting to notify admin about new user');
      await notifyNewUser(ctx.api, telegramId, ctx.from.username ?? undefined);
      logger.info('Admin notification sent successfully');
    }
    
    const username = ctx.from.username ? `@${ctx.from.username}` : 'there';
    const message = `🎨 <b>Welcome ${username}!</b>

You currently have <b>${user.stars} ⭐ stars</b>

✨ <b>Available Commands:</b>
• /gen - Generate stunning AI images
• /stars - Get more stars
• /balance - Check your balance
• /help - View all commands

💫 <i>Each image generation costs 1 star. Use /stars to get started!</i>

Need help? Use /help to learn more about all features.`;

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