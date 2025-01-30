import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../lib/logger.js';

const prisma = new PrismaClient();
const composer = new Composer<BotContext>();

composer.command('start', async (ctx) => {
  try {
    if (!ctx.from?.id) {
      await ctx.reply('Could not identify user');
      return;
    }

    // Create or get user
    const user = await prisma.user.upsert({
      where: { telegramId: ctx.from.id.toString() },
      update: {
        username: ctx.from.username ?? null
      },
      create: {
        id: ctx.from.id.toString(),
        telegramId: ctx.from.id.toString(),
        username: ctx.from.username ?? null,
        stars: 1, // Give 1 free star
      }
    });

    await ctx.reply(
      `Welcome to Selfi! 🤖✨\n\nI can help you generate amazing images using AI. Each generation costs 1 star. ${
        user.stars > 0 ? `\n\nYou have ${user.stars} ⭐` : ''
      }\n\nCommands:\n/gen - Generate an image\n/stars - Get more stars`
    );
  } catch (error) {
    logger.error({ error }, 'Failed to start bot');
    await ctx.reply('Sorry, something went wrong while starting the bot.');
  }
});

export { composer as startCommand };