import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { logger } from '../../lib/logger.js';

const composer = new Composer<BotContext>();

composer.command('help', async (ctx) => {
  try {
    const helpText = `📱 *Selfi Bot Commands*

/gen [prompt] - Generate an image from your text prompt. Each generation costs 1 star ⭐
/stars - Open the stars shop to buy more stars for generations
/balance - Check your current stars balance and transaction history
/help - Show this help message

*How to generate images:*
1. Make sure you have stars (buy them with /stars)
2. Use the /gen command followed by your prompt
3. Wait a few seconds for your image

*Example:*
/gen a photorealistic selfie of a young woman with brown hair and blue eyes, wearing a red dress

*Need help or have questions?*
Contact @${process.env.SUPPORT_USERNAME || 'support'}`;

    await ctx.reply(helpText, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error({ error }, 'Failed to show help');
    await ctx.reply('Sorry, something went wrong. Please try again later.');
  }
});

export default composer;