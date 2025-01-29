import { Bot, session, Context } from 'grammy';
import { apiThrottler } from '@grammyjs/auto-retry';
import { run } from '@grammyjs/runner';
import { prisma } from './lib/prisma';
import { config } from './config';
import { logger } from './lib/logger';
import { server } from './server';
import { setupCommands } from './bot/commands';
import { handlePreCheckoutQuery, handleSuccessfulPayment } from './lib/payments';

interface SessionData {
  stars: number;
  activeCommand?: string;
}

// Extend Context type
type BotContext = Context & {
  session: SessionData;
};

async function main() {
  logger.info('Starting Selfi Bot...');

  // Initialize bot
  const bot = new Bot<BotContext>(config.TELEGRAM_BOT_TOKEN);

  // Add session middleware
  bot.use(session({
    initial: () => ({
      stars: 0
    })
  }));

  // Add auto retry for throttled requests
  bot.api.config.use(apiThrottler());

  // Setup command handlers
  setupCommands(bot);

  // Handle payment pre-checkout queries
  bot.on('pre_checkout_query', async (ctx) => {
    const query = ctx.preCheckoutQuery;
    logger.info({ queryId: query.id }, 'Received pre-checkout query');

    const isValid = await handlePreCheckoutQuery(query);
    await ctx.answerPreCheckoutQuery(isValid);
  });

  // Handle successful payments
  bot.on('message:successful_payment', async (ctx) => {
    try {
      const payment = ctx.message.successful_payment;
      const userId = ctx.from.id.toString();

      logger.info({ userId }, 'Received successful payment');

      const result = await handleSuccessfulPayment(payment, userId);

      // Send confirmation message
      await ctx.reply(
        `✨ Payment successful!\n\n` +
        `Added ${result.payment.starsGranted} ⭐ to your balance.\n` +
        `New balance: ${result.user.stars} ⭐\n\n` +
        `Thank you for your support! 🙏`
      );
    } catch (error) {
      logger.error('Error handling payment:', error);
      await ctx.reply('Sorry, there was a problem processing your payment. Please contact support.');
    }
  });

  // Global error handler
  bot.catch((err) => {
    const ctx = err.ctx;
    const e = err.error;
    
    logger.error({
      update_id: ctx.update.update_id,
      error: e
    }, 'Error handling update');

    // Send error message to user
    ctx.reply(
      'Sorry, something went wrong while processing your request.\n' +
      'Please try again later.'
    ).catch((e) => {
      logger.error('Error sending error message:', e);
    });
  });

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