import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';

// Public commands (available without approval)
import startCommand from './start.js';
import helpCommand from './help.js';
import requestCommand from './request.js';

// Protected commands (require approval)
import starsCommand from './stars.js';
import genCommand from './gen.js';
import balanceCommand from './balance.js';

// Admin-only commands
import grantCommand from './grant.js';
import approveCommand from './approve.js';

// Payments handling
import payments from '../payments/index.js';

const composer = new Composer<BotContext>();

// Register public commands first
composer.use(startCommand);
composer.use(helpCommand);
composer.use(requestCommand);

// Then protected commands (these will be filtered by middleware)
composer.use(starsCommand);
composer.use(genCommand);
composer.use(balanceCommand);

// Finally admin commands (these have their own checks)
composer.use(grantCommand);
composer.use(approveCommand);

// Payment handling
composer.use(payments);

export default composer;