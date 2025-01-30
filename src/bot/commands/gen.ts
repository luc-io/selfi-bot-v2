import { Composer } from 'grammy';
import { BotContext } from '../../types/bot';
import { GenerationService } from '../../services/generation';
import { logger } from '../../lib/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const composer = new Composer<BotContext>();

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

  try {
    // Check user stars balance
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from.id.toString() }
    });
    
    if (!user?.stars || user.stars < 1) {
      await ctx.reply('You need at least 1 star to generate an image. Use /stars to buy more.');
      return;
    }

    await ctx.reply('🎨 Generating your image...');

    const { imageUrl } = await GenerationService.generate(user.id, {
      prompt,
    });

    await ctx.replyWithPhoto(imageUrl);
  } catch (error) {
    logger.error({ error }, 'Generation failed');
    await ctx.reply('Sorry, something went wrong while generating your image.');
  }
});

export default composer;