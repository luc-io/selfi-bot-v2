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
import privacyCommand from './privacy.js';
import payments from '../payments/index.js';

const composer = new Composer<BotContext>();

composer.use(startCommand);
composer.use(starsCommand);
composer.use(genCommand);
composer.use(balanceCommand);
composer.use(helpCommand);
composer.use(grantCommand);
composer.use(requestCommand);
composer.use(approveCommand);
composer.use(privacyCommand);
composer.use(payments);

export default composer;