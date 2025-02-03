import { Composer } from 'grammy';
import { BotContext } from '../../types/bot.js';
import { GenerationService } from '../../services/generation.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { Ids } from '../../types/ids.js';

const composer = new Composer<BotContext>();

/**
 * /gen command - Generate an image from a text prompt
 * Usage: /gen a majestic dragon
 */
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

  const telegramId = Ids.telegram(ctx.from.id.toString());

  try {
    // Check user stars balance
    const user = await prisma.user.findUnique({
      where: { telegramId }
    });
    
    if (!user?.stars || user.stars < 1) {
      await ctx.reply('You need at least 1 star to generate an image. Use /stars to buy more.');
      return;
    }

    await ctx.reply('🎨 Generating your image...');

    // Pass telegramId to generation service
    const { imageUrl } = await GenerationService.generate(telegramId, {
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
  }
});

export default composer;