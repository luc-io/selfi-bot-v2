import { Bot } from 'grammy';
import { BotContext } from './types/bot.js';
import { config } from './config.js';
import { fastify } from 'fastify';
import { setupServer } from './server/index.js';
import commands from './bot/commands/index.js';
import { logger } from './lib/logger.js';

const bot = new Bot<BotContext>(config.TELEGRAM_BOT_TOKEN);

bot.api.config.use((prev, method, payload) => {
  return prev(method, {
    ...payload,
    parse_mode: 'HTML',
  });
});

bot.use(commands);
logger.info('Bot commands registered');

const server = fastify();
setupServer(server, bot);

await server.listen({
  port: parseInt(config.PORT, 10),
  host: '0.0.0.0'
});
logger.info(`Server started on port ${config.PORT}`);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down');
  process.exit(0);
});