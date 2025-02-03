import { BotCommandContext } from 'grammy';
import { BotContext } from '../types.js';

const start = {
  command: 'start',
  description: 'Start using Selfi Bot',
  handler: async (ctx: BotCommandContext<BotContext>) => {
    const { from } = ctx;
    const username = from?.username ? `@${from.username}` : 'there';

    const greeting = `👋 Welcome ${username} to Selfi Bot!

🌟 Here's what I can do for you:

/gen - Generate a new image with AI
/stars - Buy stars (currency for generations)
/balance - Check your stars balance
/help - Show all available commands

Each image generation costs 1 star. Get started with the /stars command to purchase some stars!`;

    await ctx.reply(greeting, { parse_mode: 'Markdown' });
  }
};

export default start;