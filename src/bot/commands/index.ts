import { Bot } from 'grammy';
import { BotContext } from '../../types/bot';
import { startCommand } from './start';
import genCommand from './gen';
import starsCommand from './stars';

export function setupCommands(bot: Bot<BotContext>) {
  bot.use(startCommand);
  bot.use(genCommand);
  bot.use(starsCommand);
}