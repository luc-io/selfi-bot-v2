import { Context } from 'grammy';
import { logger } from '../../lib/logger';
import { generationService } from '../../services/generation';
import { prisma } from '../../lib/prisma';

export async function genHandler(ctx: Context) {
  try {
    // Get prompt
    const message = ctx.message?.text;
    if (!message) {
      await ctx.reply('Please provide a prompt after /gen');
      return;
    }

    const prompt = message.replace('/gen', '').trim();
    if (!prompt) {
      await ctx.reply('Please provide a prompt after /gen');
      return;
    }

    // Get user
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
      await ctx.reply('Error: Could not identify user');
      return;
    }

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true, stars: true }
    });

    if (!user) {
      await ctx.reply('Please start the bot with /start first');
      return;
    }

    // Check stars
    const generationCost = 2;
    if (user.stars < generationCost) {
      await ctx.reply(
        `❌ You need at least ${generationCost} stars to generate an image.\n` +
        `Current balance: ${user.stars}⭐\n` +
        `Get more stars using /stars command`
      );
      return;
    }

    // Start generation
    const statusMsg = await ctx.reply('🎨 Generating your image...');

    try {
      // Get default model
      const baseModel = await prisma.baseModel.findFirst({
        where: { isDefault: true }
      });

      if (!baseModel) {
        throw new Error('No default model configured');
      }

      // Generate
      const generation = await generationService.generateImage({
        userId: user.id,
        baseModelId: baseModel.id,
        prompt,
        starsRequired: generationCost
      });

      // Send image
      await ctx.replyWithPhoto(generation.imageUrl, {
        caption: `✨ Generated with prompt:\n${prompt}\n\n⭐ -${generationCost} stars`
      });

    } catch (error) {
      logger.error('Generation error:', error);
      await ctx.reply('Sorry, something went wrong during generation. Please try again.');
    } finally {
      // Clean up status message
      await ctx.api.deleteMessage(statusMsg.chat.id, statusMsg.message_id);
    }

  } catch (error) {
    logger.error('Error in gen command:', error);
    await ctx.reply('Sorry, something went wrong. Please try again later.');
  }
}