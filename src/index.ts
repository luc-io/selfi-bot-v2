import { Bot } from 'grammy';
import { BotContext } from './types/bot.js';
import { config } from './config.js';
import { fastify } from 'fastify';
import setupServer from './server/index.js';
import commands from './bot/commands/index.js';  // Changed to default import
import { logger } from './lib/logger.js';

const bot = new Bot<BotContext>(config.TELEGRAM_BOT_TOKEN, {
  client: {
    apiRoot: config.TELEGRAM_BOT_API_URL,
  }
});

bot.api.config.use((prev, method, payload) => {
  return prev(method, {
    ...payload,
    parse_mode: 'HTML',
  });
});

bot.use(commands); // Use the commands directly since it's already a Composer
logger.info('Bot commands registered');

if (config.BOT_WEBHOOK_URL) {
  const server = fastify();
  setupServer(server, bot);
  
  await server.listen({ port: config.PORT, host: '0.0.0.0' });
  logger.info(`Server started on port ${config.PORT}`);
} else {
  logger.info('Starting in webhook mode');
  await bot.start();
}

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down');
  process.exit(0);
});