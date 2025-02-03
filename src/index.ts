import { Bot } from 'grammy';
import { BotContext } from './types/bot.js';
import { config } from './config.js';
import { fastify } from 'fastify';
import { setupServer } from './server/index.js';
import commands from './bot/commands/index.js';
import { logger } from './lib/logger.js';
import { autoRetry } from '@grammyjs/auto-retry';
import { parseMode } from '@grammyjs/parse-mode';

async function setupWebhook(bot: Bot<BotContext>): Promise<boolean> {
  try {
    // First, delete any existing webhook
    await bot.api.deleteWebhook();
    logger.info('Existing webhook deleted');

    // Try to set the webhook
    const webhookResponse = await bot.api.setWebhook('https://qubot-e.blackiris.art/bot', {
      drop_pending_updates: true
    });

    logger.info({ 
      success: webhookResponse,
      url: 'https://qubot-e.blackiris.art/bot'
    }, 'Webhook setup attempt');

    // Verify webhook info
    const webhookInfo = await bot.api.getWebhookInfo();
    logger.info({ webhookInfo }, 'Current webhook info');

    return webhookResponse;
  } catch (error) {
    logger.error({ error }, 'Failed to setup webhook');
    return false;
  }
}

async function main() {
  // Initialize bot
  const bot = new Bot<BotContext>(config.TELEGRAM_BOT_TOKEN);
  logger.info('Bot instance created');

  // Register commands
  bot.use(commands);
  logger.info('Bot commands registered');

  // Setup server with webhook
  const server = fastify();
  setupServer(server, bot);
  logger.info('Server routes configured');

  // Start server
  await server.listen({
    port: parseInt(config.PORT, 10),
    host: '0.0.0.0'
  });
  logger.info(`Server started on port ${config.PORT}`);

  // Connect to database (this happens in prisma.ts)

  // Setup webhook
  const webhookSuccess = await setupWebhook(bot);
  if (!webhookSuccess) {
    logger.warn('Failed to set webhook, bot might not receive updates');
  }

  // Error handling
  bot.catch((err) => {
    logger.error({
      error: err,
      msg: 'Bot error occurred'
    });
  });
}

// Handle shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  try {
    const bot = new Bot<BotContext>(config.TELEGRAM_BOT_TOKEN);
    await bot.api.deleteWebhook();
    logger.info('Webhook deleted');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Start the bot
main().catch((error) => {
  logger.error('Failed to start bot:', error);
  process.exit(1);
});