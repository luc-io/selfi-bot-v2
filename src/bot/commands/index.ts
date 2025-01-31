import { Bot } from 'grammy';
import type { BotContext } from '../../types/bot.js';
import { startCommand } from './start.js';
import genCommand from './gen.js';
import starsCommand from './stars.js';
import balanceCommand from './balance.js';
import helpCommand from './help.js';

export function setupCommands(bot: Bot<BotContext>) {
  bot.use(startCommand);
  bot.use(genCommand);
  bot.use(starsCommand);
  bot.use(balanceCommand);
  bot.use(helpCommand);
}