import { Bot } from 'grammy';
import { BotContext } from './types/bot.js';
import { config } from './config.js';
import { fastify } from 'fastify';
import { setupServer } from './server/index.js';
import commands from './bot/commands/index.js';
import { logger } from './lib/logger.js';
import { autoRetry } from '@grammyjs/auto-retry';
import { run } from '@grammyjs/runner';

const bot = new Bot<BotContext>(config.TELEGRAM_BOT_TOKEN);

// Add auto-retry for better reliability
bot.api.config.use(autoRetry());

// Set HTML as default parse mode
bot.api.config.use((prev, method, payload) => {
  return prev(method, {
    ...payload,
    parse_mode: 'HTML',
  });
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

// Start bot in long polling mode if no PUBLIC_URL is set
if (!config.PUBLIC_URL) {
  bot.start();
  logger.info('Bot started in long polling mode');
} else {
  // Use webhook mode if PUBLIC_URL is available
  const webhookUrl = `${config.PUBLIC_URL}/bot`;
  await bot.api.setWebhook(webhookUrl);
  logger.info(`Webhook set to ${webhookUrl}`);
}

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
    // Delete webhook if it was set
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