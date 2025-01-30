import { Bot, session } from 'grammy';
import { autoRetry } from '@grammyjs/auto-retry';
import { run } from '@grammyjs/runner';
import { BotContext } from './types/bot';
import { config } from './config.js';
import { setupCommands } from './bot/commands';
import { setupServer } from './server';
import { logger } from './lib/logger';

// Create bot instance
const bot = new Bot<BotContext>(config.TELEGRAM_BOT_TOKEN);

// Add middleware
bot.api.config.use(autoRetry());

bot.use(session({
  initial: () => ({})
}));

// Error handling
bot.catch((err) => {
  logger.error({ error: err }, 'Bot error');
});

// Setup bot commands
setupCommands(bot);

// Start bot
run(bot);

// Setup API server
setupServer();

logger.info('Bot started');