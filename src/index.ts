import { Bot, BotConfig } from 'grammy';
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
    const webhookUrl = `${config.PUBLIC_URL || 'https://selfi-dev.blackiris.art'}/bot`;
    const webhookResponse = await bot.api.setWebhook(webhookUrl, {
      drop_pending_updates: true,
      allowed_updates: ['message', 'callback_query', 'pre_checkout_query']
    });

    logger.info({ 
      success: webhookResponse,
      url: webhookUrl
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
  try {
    // Initialize bot
    const bot = new Bot<BotContext>(config.TELEGRAM_BOT_TOKEN);
    logger.info('Bot instance created');

    // Add middleware
    bot.api.config.use(autoRetry());
    bot.api.config.use(parseMode('HTML'));
    logger.info('Bot middleware configured');

    // Register commands
    bot.use(commands);
    logger.info('Bot commands registered');

    // Setup server with webhook
    const server = fastify({
      logger: true
    });

    setupServer(server, bot);
    logger.info('Server routes configured');

    // Connect to database first
    const prisma = (await import('./lib/prisma.js')).prisma;
    await prisma.$connect();
    logger.info('Connected to database');

    // Start server
    server.listen({ 
      port: parseInt(config.PORT, 10), 
      host: '0.0.0.0',
    }, (err: Error | null, address: string) => {
      if (err) {
        logger.error({ error: err }, 'Failed to start server');
        process.exit(1);
      }
      logger.info(`Server started on ${address}`);
    });

    // Setup webhook after server is running
    const webhookSuccess = await setupWebhook(bot);
    if (!webhookSuccess) {
      logger.warn('Failed to set webhook, bot might not receive updates');
    } else {
      logger.info('Webhook setup successful');
    }

    // Error handling
    bot.catch((err) => {
      logger.error({
        error: err,
        msg: 'Bot error occurred'
      });
    });

  } catch (error) {
    logger.error({ error }, 'Failed to start bot');
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  try {
    const bot = new Bot<BotContext>(config.TELEGRAM_BOT_TOKEN);
    await bot.api.deleteWebhook();
    logger.info('Webhook deleted');

    const prisma = (await import('./lib/prisma.js')).prisma;
    await prisma.$disconnect();
    logger.info('Disconnected from database');

    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Clean shutdown on interrupts
process.on('SIGINT', () => {
  logger.info('SIGINT received');
  process.emit('SIGTERM', 'SIGINT');
});

// Start the bot
main().catch((error) => {
  logger.error('Failed to start bot:', error);
  process.exit(1);
});