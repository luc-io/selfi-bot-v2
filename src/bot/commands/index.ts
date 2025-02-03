import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import startCommand from './start.js';
import starsCommand from './stars.js';
import genCommand from './gen.js';

const composer = new Composer<BotContext>();

composer.use(startCommand);
composer.use(starsCommand);
composer.use(genCommand);

export default composer;