import { Bot } from 'grammy';
import startCommand from './start.js';
import gen from './gen.js';
import balance from './balance.js';

export const commands = {
  start: startCommand,
  gen,
  balance,
};

export const setupCommands = (bot: Bot) => {
  bot.command('start', startCommand);
  bot.command('gen', gen);
  bot.command('balance', balance);
};