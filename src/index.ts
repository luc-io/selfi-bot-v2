import { Bot, session } from 'grammy';
import { BotContext } from './types/context';
import { setupCommands } from './bot/commands/index.js';
import { config } from './config';

const bot = new Bot<BotContext>(config.BOT_TOKEN);

// Set up session
bot.use(session({
  initial: () => ({
    // Initialize your session data here
  })
}));

// Initialize commands
setupCommands(bot);

export const startBot = async () => {
  try {
    await bot.start();
    console.log('Bot started successfully');
  } catch (error) {
    console.error('Error starting bot:', error);
    process.exit(1);
  }
};