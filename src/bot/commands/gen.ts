import { GenerationService } from '../../services/generation.js';
import { Bot } from 'grammy';
import { UserService } from '../../lib/user.js';
import { logger } from '../../lib/logger.js';

export async function setupGenerationCommand(bot: Bot) {
  bot.command('gen', async (ctx) => {
    try {
      const telegramId = ctx.from.id.toString();
      const prompt = ctx.message.text.substring(5).trim();

      if (!prompt) {
        await ctx.reply(
          'Please provide a prompt for image generation.\n\nExample: /gen a beautiful landscape'
        );
        return;
      }

      // Get or create user
      const user = await UserService.getUser(telegramId);

      if (!user) {
        await ctx.reply('Please register first with /start');
        return;
      }

      if (user.stars < 1) {
        await ctx.reply('Not enough stars! Buy some with /buy');
        return;
      }

      const message = await ctx.reply('🎨 Generating your image...');

      const { imageUrl } = await GenerationService.generate(user.databaseId, {
        prompt,
        negativePrompt: ctx.message.text.includes('--no')
          ? ctx.message.text.split('--no')[1].trim()
          : undefined
      });

      // Send the result
      await ctx.api.deleteMessage(ctx.chat.id, message.message_id);
      await ctx.replyWithPhoto(imageUrl);

    } catch (error) {
      logger.error({ 
        error,
        userId: ctx.from.id,
        command: 'gen'
      }, 'Generation command failed');

      await ctx.reply(
        'Sorry, something went wrong. Please try again or contact support if the issue persists.'
      );
    }
  });
}