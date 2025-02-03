import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { GenerationService } from '../../services/generation.js';
import { logger } from '../../lib/logger.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const composer = new Composer<BotContext>();

// Track user generation states
const generatingUsers = new Map<string, { timestamp: number }>();

// Cleanup old generation states (anything older than 2 minutes)
const cleanupGeneratingUsers = () => {
  const now = Date.now();
  for (const [userId, data] of generatingUsers.entries()) {
    if (now - data.timestamp > 2 * 60 * 1000) {
      generatingUsers.delete(userId);
    }
  }
};

composer.command('gen', async (ctx) => {
  const prompt = ctx.message?.text?.replace('/gen', '').trim();
  if (!prompt) {
    await ctx.reply('Please provide a prompt after /gen command');
    return;
  }

  if (!ctx.from?.id) {
    await ctx.reply('Could not identify user');
    return;
  }

  const telegramId = ctx.from.id.toString();

  // Cleanup old states first
  cleanupGeneratingUsers();

  // Check if user is already generating (and the state is fresh)
  const userGenerating = generatingUsers.get(telegramId);
  if (userGenerating && (Date.now() - userGenerating.timestamp) < 2 * 60 * 1000) {
    await ctx.reply('⏳ Please wait for your current generation to complete before starting a new one.');
    return;
  }

  try {
    // Check user stars balance
    const user = await prisma.user.findUnique({
      where: { telegramId }
    });
    
    if (!user?.stars || user.stars < 1) {
      await ctx.reply('You need at least 1 star to generate an image. Use /stars to buy more.');
      return;
    }

    // Set user as generating with timestamp
    generatingUsers.set(telegramId, { timestamp: Date.now() });
    await ctx.reply('🎨 Generating your image...');

    const { imageUrl } = await GenerationService.generate(user.telegramId, {
      prompt,
    });

    await ctx.replyWithPhoto(imageUrl);
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
    logger.error({ 
      error: errorMessage,
      prompt,
      telegramId
    }, 'Generation command failed');
    await ctx.reply('Sorry, something went wrong while generating your image.');
  } finally {
    // Clear user generating state
    generatingUsers.delete(telegramId);
  }
});

export default composer;