import { BotCommandContext } from 'grammy';
import { BotContext } from '../types.js';
import { StarsService } from '../services/stars.js';

const GENERATION_COST = 1;

const generate = {
  command: 'gen',
  description: 'Generate an image with AI',
  handler: async (ctx: BotCommandContext<BotContext>) => {
    const { from, message } = ctx;
    if (!from) return;

    const prompt = message.text.split('/gen')[1]?.trim();
    if (!prompt) {
      await ctx.reply('Please provide a prompt after /gen command. For example:\n/gen a photorealistic portrait of a young woman');
      return;
    }

    try {
      const hasEnoughStars = await StarsService.checkBalance(from.id.toString(), GENERATION_COST);
      if (!hasEnoughStars) {
        await ctx.reply(`⚠️ You need at least ${GENERATION_COST} star to generate an image. Use /stars to buy some!`);
        return;
      }

      // Start the generation process
      await ctx.reply('🎨 Starting image generation...');

      try {
        // Deduct stars first
        await StarsService.updateStars(from.id.toString(), {
          amount: -GENERATION_COST,
          type: 'GENERATION',
          metadata: { prompt }
        });

        // TODO: Implement actual image generation here
        await ctx.reply('🖼 Here\'s your generated image!');
        
      } catch (error) {
        logger.error('Error in image generation:', error);
        await ctx.reply('❌ Sorry, something went wrong during generation. Your stars have been refunded.');
        
        // Refund the stars
        await StarsService.updateStars(from.id.toString(), {
          amount: GENERATION_COST,
          type: 'REFUND',
          metadata: { prompt, error: 'Generation failed' }
        });
      }

    } catch (error) {
      logger.error('Error checking balance:', error);
      await ctx.reply('❌ Sorry, something went wrong. Please try again later.');
    }
  }
};

export default generate;