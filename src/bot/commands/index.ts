import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import startCommand from './start.js';
import starsCommand from './stars.js';
import genCommand from './gen.js';
import balanceCommand from './balance.js';
import helpCommand from './help.js';
import grantCommand from './grant.js';
import requestCommand from './request.js';
import approveCommand from './approve.js';
import payments from '../payments/index.js';

const composer = new Composer<BotContext>();

composer.use(startCommand);
composer.use(starsCommand);
composer.use(genCommand);
composer.use(balanceCommand);
composer.use(helpCommand);
composer.use(grantCommand);
composer.use(requestCommand);  // Add request command
composer.use(approveCommand);  // Add approve command
composer.use(payments);

export default composer;