import { BotCommandContext } from 'grammy';
import { BotContext } from '../types.js';

const help = {
  command: 'help',
  description: 'Show all available commands',
  handler: async (ctx: BotCommandContext<BotContext>) => {
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
  }
};

export default help;