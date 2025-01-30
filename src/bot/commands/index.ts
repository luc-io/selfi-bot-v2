import { Bot } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { startCommand } from './start.js';
import genCommand from './gen.js';
import starsCommand from './stars.js';

export function setupCommands(bot: Bot<BotContext>) {
  bot.use(startCommand);
  bot.use(genCommand);
  bot.use(starsCommand);
}