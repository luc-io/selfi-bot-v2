import { Bot, session } from 'grammy';
import { apiThrottler } from '@grammyjs/auto-retry';
import { run } from '@grammyjs/runner';
import { prisma } from './lib/prisma';
import { config } from './config';
import { logger } from './lib/logger';
import { server } from './server';
import { setupCommands } from './bot/commands';

async function main() {
  logger.info('Starting Selfi Bot...');

  // Initialize bot
  const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

  // Add session middleware
  bot.use(session({
    initial: () => ({
      stars: 0,
      activeCommand: null
    })
  }));

  // Add auto retry for throttled requests
  bot.api.config.use(apiThrottler());

  // Setup command handlers
  setupCommands(bot);

  // Start API server
  const port = config.PORT || 3000;
  server.listen({ port }, (err) => {
    if (err) {
      logger.error('Failed to start server:', err);
      process.exit(1);
    }
    logger.info(`Server running on port ${port}`);
  });

  // Start bot
  const runner = run(bot);
  
  // Handle shutdown
  const stopHandler = async () => {
    logger.info('Shutting down...');
    
    // Stop bot
    await runner.stop();
    
    // Close database connection
    await prisma.$disconnect();
    
    // Close server
    await server.close();
    
    process.exit(0);
  };

  process.on('SIGINT', stopHandler);
  process.on('SIGTERM', stopHandler);

  logger.info('Bot started successfully');
}

main().catch((error) => {
  logger.error('Failed to start bot:', error);
  process.exit(1);
});