import { BotCommandContext } from 'grammy';
import { BotContext } from '../types.js';
import { StarsService } from '../services/stars.js';

const balance = {
  command: 'balance',
  description: 'Check your stars balance',
  handler: async (ctx: BotCommandContext<BotContext>) => {
    const { from } = ctx;
    if (!from) return;

    try {
      const userBalance = await StarsService.getBalance(from.id.toString());
      const recentTransactions = userBalance.starTransactions
        .map(tx => {
          const sign = tx.amount > 0 ? '+' : '';
          const emoji = tx.amount > 0 ? '⬆️' : '⬇️';
          return `${emoji} ${sign}${tx.amount} (${tx.type})`;
        })
        .join('\n');

      const message = `💫 *Your Stars Balance*
      
Current Balance: ${userBalance.stars} ⭐
Total Bought: ${userBalance.totalBoughtStars || 0} ⭐
Total Spent: ${userBalance.totalSpentStars || 0} ⭐

*Recent Transactions:*
${recentTransactions || 'No recent transactions'}

Use /stars to buy more stars!`;

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      if (error instanceof Error && error.message === 'User not found') {
        await ctx.reply('You haven\'t used any stars yet! Use /stars to buy some.');
      } else {
        logger.error('Error getting balance:', error);
        await ctx.reply('❌ Sorry, something went wrong. Please try again later.');
      }
    }
  }
};

export default balance;