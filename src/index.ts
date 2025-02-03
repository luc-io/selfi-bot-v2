import { Bot } from 'grammy';
import { BotContext } from './types/bot.js';
import { config } from './config.js';
import { fastify } from 'fastify';
import { setupServer } from './server/index.js';
import commands from './bot/commands/index.js';
import { logger } from './lib/logger.js';
import { autoRetry } from '@grammyjs/auto-retry';
import { parseMode } from '@grammyjs/parse-mode';

// Initialize bot
const bot = new Bot<BotContext>(config.TELEGRAM_BOT_TOKEN);
logger.info('Bot instance created');

// Add middleware
bot.api.config.use(autoRetry());
bot.api.config.use(parseMode('HTML'));

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

// First, delete any existing webhook
await bot.api.deleteWebhook();
logger.info('Existing webhook deleted');

// Set new webhook URL
const webhookUrl = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/setWebhook?url=https://qubot-e.blackiris.art/bot`;
try {
  const response = await fetch(webhookUrl);
  const result = await response.json();
  logger.info({ result }, 'Webhook setup response');
} catch (error) {
  logger.error({ error }, 'Failed to set webhook');
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
    await bot.api.deleteWebhook();
    logger.info('Webhook deleted');
    
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});