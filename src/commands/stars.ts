import { BotCommandContext } from 'grammy';
import { BotContext } from '../types.js';

const STAR_PACKAGES = [
  { stars: 10, price: 2 },
  { stars: 50, price: 8 },
  { stars: 100, price: 15 },
  { stars: 500, price: 65 },
];

const stars = {
  command: 'stars',
  description: 'Buy stars for generations',
  handler: async (ctx: BotCommandContext<BotContext>) => {
    const { from } = ctx;
    if (!from) return;

    try {
      const packages = STAR_PACKAGES.map(pkg => ({
        label: `${pkg.stars} ⭐ for ${pkg.price} $${pkg.price > 1 ? '' : ''}`,
        amount: pkg.price * 100 // Convert to cents
      }));

      const prices = packages.map(pkg => ({
        label: pkg.label,
        amount: pkg.amount
      }));

      const title = '⭐ Buy Stars';
      const description = 'Select the amount of stars you want to purchase:';
      const payload = 'stars_purchase';

      await ctx.replyWithInvoice(title, description, payload, process.env.PAYMENT_TOKEN!, 'USD', prices);

    } catch (error) {
      logger.error('Error creating invoice:', error);
      await ctx.reply('❌ Sorry, the stars shop is temporarily unavailable. Please try again later.');
    }
  }
};

export default stars;