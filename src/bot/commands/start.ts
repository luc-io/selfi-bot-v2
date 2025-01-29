import { Context } from 'grammy';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';

export async function startHandler(ctx: Context) {
  try {
    const telegramId = ctx.from?.id.toString();
    const username = ctx.from?.username;

    if (!telegramId) {
      await ctx.reply('Error: Could not identify user');
      return;
    }

    // Get or create user
    const user = await prisma.user.upsert({
      where: { telegramId },
      update: { username },
      create: {
        id: telegramId,
        telegramId,
        username,
        stars: 10 // Welcome bonus
      }
    });

    // Welcome message
    await ctx.reply(
      `Welcome to Selfi Bot! 🤖✨\n\n` +
      `I can help you generate images using AI and train your own styles.\n\n` +
      `🌟 You have ${user.stars} stars to start with.\n\n` +
      `Commands:\n` +
      `/gen - Generate an image\n` +
      `/balance - Check your stars balance\n\n` +
      `You can also use our mini app to train your own styles!`
    );

  } catch (error) {
    logger.error('Error in start command:', error);
    await ctx.reply('Sorry, something went wrong. Please try again later.');
  }
}