import { Bot } from 'grammy';
import { BotContext } from '../../types/context';
import startCommand from './start.js';
import gen from './gen.js';
import balance from './balance.js';

export const commands = {
  start: startCommand,
  gen,
  balance,
};

export const setupCommands = (bot: Bot<BotContext>) => {
  bot.command('start', startCommand);
  bot.command('gen', gen);
  bot.command('balance', balance);
};