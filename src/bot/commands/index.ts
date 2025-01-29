import { Bot } from 'grammy';
import { startHandler } from './start';
import { genHandler } from './gen';
import { balanceHandler } from './balance';
import { logger } from '../../lib/logger';

const commands = [
  { command: 'start', description: 'Start the bot' },
  { command: 'gen', description: 'Generate an image' },
  { command: 'balance', description: 'Check your stars balance' },
] as const;

export async function setupCommands(bot: Bot) {
  // Set commands
  try {
    await bot.api.setMyCommands(commands);
  } catch (error) {
    logger.error('Failed to set commands:', error);
  }

  // Register handlers
  bot.command('start', startHandler);
  bot.command('gen', genHandler);
  bot.command('balance', balanceHandler);
}