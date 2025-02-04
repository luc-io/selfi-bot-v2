import { Composer, InputMediaBuilder } from "grammy";
import { generateImage } from "../../services/generation.js";
import { hasSubscription } from "../middlewares/subscription.js";
import { handleError } from "../../utils/error.js";
import { BotContext } from "../../types/bot.js";
import { prisma } from "../../lib/prisma.js";
import { logger } from "../../lib/logger.js";

const composer = new Composer<BotContext>();

// Add a filter to only handle text messages with /gen command
composer.command("gen", hasSubscription, async (ctx) => {
  // Early return if this is not a direct command message
  if (!ctx.message?.text?.startsWith("/gen")) {
    return;
  }

  // Add processing state tracking
  const messageId = ctx.message.message_id;
  const chatId = ctx.chat.id;
  const processingKey = `${chatId}:${messageId}`;
  
  try {
    logger.info({
      messageId,
      chatId,
      processingKey,
      command: ctx.message.text
    }, "Starting generation command");

    // Get user's saved parameters
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from?.id.toString() },
      include: { parameters: true }
    });

    // Extract generation parameters from user settings
    const userParams = user?.parameters?.params as {
      image_size?: string;
      num_inference_steps?: number;
      guidance_scale?: number;
      num_images?: number;
      enable_safety_checker?: boolean;
      output_format?: string;
    } | null;

    const prompt = ctx.message.text.replace(/^\/gen\s+/, "").trim();
    if (!prompt) {
      await ctx.reply("Please provide a prompt after the /gen command.");
      return;
    }

    const response = await generateImage({
      prompt,
      imageSize: userParams?.image_size,
      numInferenceSteps: userParams?.num_inference_steps,
      guidanceScale: userParams?.guidance_scale,
      numImages: userParams?.num_images,
      enableSafetyChecker: userParams?.enable_safety_checker,
      outputFormat: userParams?.output_format as 'jpeg' | 'png' | undefined,
    });

    // If there is only one image, use replyWithPhoto
    if (response.images.length === 1) {
      await ctx.replyWithPhoto(response.images[0].url);
    } 
    // If there are multiple images, use sendMediaGroup
    else {
      const mediaGroup = response.images.map(image => 
        InputMediaBuilder.photo(image.url)
      );
      await ctx.replyWithMediaGroup(mediaGroup);
    }

    logger.info({
      messageId,
      chatId,
      processingKey,
      imagesCount: response.images.length
    }, "Generation command completed");

  } catch (error) {
    logger.error({
      messageId,
      chatId,
      processingKey,
      error
    }, "Generation command failed");
    handleError(ctx, error);
  }
});

export default composer;