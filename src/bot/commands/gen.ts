import { Composer, InputMediaBuilder } from "grammy";
import { generateImage } from "../../services/generation.js";
import { hasSubscription } from "../middlewares/subscription.js";
import { handleError } from "../../utils/error.js";
import { BotContext } from "../../types/bot.js";
import { prisma } from "../../lib/prisma.js";
import { logger } from "../../lib/logger.js";

const composer = new Composer<BotContext>();

// Cache to prevent duplicate processing
const processingCache = new Set<string>();

// Clear old entries from cache every minute
setInterval(() => {
  processingCache.clear();
}, 60000);

composer.command("gen", hasSubscription, async (ctx) => {
  // Only process text messages with the /gen command
  if (!ctx.message?.text?.startsWith("/gen")) {
    return;
  }

  // Create a unique key for this request
  const messageId = ctx.message.message_id;
  const chatId = ctx.chat.id;
  const processingKey = `${chatId}:${messageId}:${Date.now()}`;
  
  // Check if this request is already being processed
  if (processingCache.has(processingKey)) {
    logger.info({
      messageId,
      chatId,
      processingKey
    }, "Skipping duplicate generation request");
    return;
  }

  // Add to processing cache
  processingCache.add(processingKey);
  
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

    // Send a "processing" message
    const processingMsg = await ctx.reply("🎨 Generating your art...");

    const response = await generateImage({
      prompt,
      imageSize: userParams?.image_size,
      numInferenceSteps: userParams?.num_inference_steps,
      guidanceScale: userParams?.guidance_scale,
      numImages: userParams?.num_images,
      enableSafetyChecker: userParams?.enable_safety_checker,
      outputFormat: userParams?.output_format as 'jpeg' | 'png' | undefined,
    });

    // Delete the processing message
    await ctx.api.deleteMessage(chatId, processingMsg.message_id);

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
  } finally {
    // Remove from processing cache
    processingCache.delete(processingKey);
  }
});

export default composer;