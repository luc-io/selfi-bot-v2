import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { logger } from '../../lib/logger.js';

const composer = new Composer<BotContext>();

composer.command('privacy', async (ctx) => {
  try {
    const privacyText = `🔒 *Selfi Privacy Policy*

We care about your privacy. Here's what you need to know:

• We collect basic data like your Telegram ID and username
• Generated images and prompts are stored for functionality
• Training data is securely stored for your custom models
• Your data is not shared with third parties
• You can request data deletion anytime

Full privacy policy: https://github.com/luc-io/selfi-bot-v2/blob/main/PRIVACY.md

Questions? Contact @lvc_io`;

    await ctx.reply(privacyText, { parse_mode: 'Markdown' });
    logger.info({ command: 'privacy' }, 'Privacy policy sent');
  } catch (error) {
    logger.error({ error }, 'Failed to send privacy policy');
    await ctx.reply('Sorry, something went wrong. Please try again later.');
  }
});

export default composer;