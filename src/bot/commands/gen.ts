import { Composer } from 'grammy';
import { BotContext } from '../../types/bot';
import { GenerationService } from '../../services/generation';
import { logger } from '../../lib/logger';

const composer = new Composer<BotContext>();

composer.command('gen', async (ctx) => {
  const prompt = ctx.message?.text?.replace('/gen', '').trim();
  if (!prompt) {
    await ctx.reply('Please provide a prompt after /gen command');
    return;
  }

  try {
    // Check user stars balance
    const user = await ctx.user;
    if (!user?.stars || user.stars < 1) {
      await ctx.reply('You need at least 1 star to generate an image. Use /stars to buy more.');
      return;
    }

    await ctx.reply('🎨 Generating your image...');

    const { imageUrl } = await GenerationService.generate(ctx.from.id.toString(), {
      prompt,
    });

    await ctx.replyWithPhoto(imageUrl);
  } catch (error) {
    logger.error({ error }, 'Generation failed');
    await ctx.reply('Sorry, something went wrong while generating your image.');
  }
});

export default composer;