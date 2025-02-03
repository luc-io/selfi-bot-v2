import { Bot } from 'grammy';
import { BotContext } from './types/bot.js';
import { config } from './config.js';
import { fastify } from 'fastify';
import { setupServer } from './server/index.js';
import commands from './bot/commands/index.js';
import { logger } from './lib/logger.js';
import { autoRetry } from '@grammyjs/auto-retry';
import { run } from '@grammyjs/runner';
import { parseMode } from '@grammyjs/parse-mode';

// Initialize bot
const bot = new Bot<BotContext>(config.TELEGRAM_BOT_TOKEN);
logger.info('Bot instance created');

// Add auto-retry for better reliability
bot.api.config.use(autoRetry());
logger.info('Auto-retry middleware added');

// Set HTML as default parse mode
bot.api.config.use(parseMode('HTML'));
logger.info('HTML parse mode set');

// Add debug logging for commands
bot.on('message', async (ctx, next) => {
  logger.info({
    from: ctx.from?.id,
    text: ctx.message.text,
    type: ctx.message.text?.startsWith('/') ? 'command' : 'message'
  }, 'Message received');
  await next();
});

// Register commands
bot.use(commands);
logger.info('Bot commands registered');

// Setup server with webhook
const server = fastify();
setupServer(server, bot);

// Start server
await server.listen({
  port: parseInt(config.PORT, 10),
  host: '0.0.0.0'
});
logger.info(`Server started on port ${config.PORT}`);

// Start bot in long polling mode
bot.start({
  drop_pending_updates: true,
  onStart: (botInfo) => {
    logger.info({ botInfo }, 'Bot started successfully');
  },
});
logger.info('Bot started in long polling mode');

// Error handling
bot.catch((err) => {
  logger.error({
    error: err,
    msg: 'Bot error occurred'
  });
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  
  try {
    if (config.PUBLIC_URL) {
      await bot.api.deleteWebhook();
      logger.info('Webhook deleted');
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});