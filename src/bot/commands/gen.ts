import { Composer, InputMediaBuilder } from "grammy";
import { generateImage } from "../../services/generation.js";
import { hasSubscription } from "../middlewares/subscription.js";
import { handleError } from "../../utils/error.js";
import { BotContext } from "../../types/bot.js";
import { prisma } from "../../lib/prisma.js";
import { logger } from "../../lib/logger.js";

const composer = new Composer<BotContext>();

// Store the last processed command for each chat
const lastProcessed = new Map<number, { msgId: number; timestamp: number }>();

composer.command("gen", hasSubscription, async (ctx) => {
  // Ensure this is a text message with the command
  if (!ctx.message?.text) {
    return;
  }

  // Extract prompt - everything after /gen
  const prompt = ctx.message.text.split(/\/gen\s*/)[1]?.trim();
  
  // Check for empty or missing prompt
  if (!prompt) {
    await ctx.reply("❌ Please provide a prompt after the /gen command.\nExample: /gen a beautiful sunset");
    return;
  }

  // Ensure we have a valid user
  if (!ctx.from?.id) {
    await ctx.reply("Could not identify user");
    return;
  }

  const chatId = ctx.chat.id;
  const messageId = ctx.message.message_id;
  const now = Date.now();

  // Check if we've recently processed a command from this chat
  const last = lastProcessed.get(chatId);
  if (last) {
    if (messageId === last.msgId) {
      logger.info({
        chatId,
        messageId,
        lastMsgId: last.msgId,
        timeDiff: now - last.timestamp
      }, "Skipping duplicate command");
      return;
    }
    // If it's a new message but within 5 seconds, ignore it
    if (now - last.timestamp < 5000) {
      logger.info({
        chatId,
        messageId,
        lastMsgId: last.msgId,
        timeDiff: now - last.timestamp
      }, "Command too soon after last one");
      return;
    }
  }

  // Update last processed command
  lastProcessed.set(chatId, { msgId: messageId, timestamp: now });

  // Clear old entries every minute
  setTimeout(() => {
    const entry = lastProcessed.get(chatId);
    if (entry?.msgId === messageId) {
      lastProcessed.delete(chatId);
    }
  }, 60000);

  try {
    logger.info({
      messageId,
      chatId,
      command: ctx.message.text
    }, "Starting generation command");

    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from.id.toString() },
      include: { parameters: true }
    });

    const userParams = user?.parameters?.params as {
      image_size?: string;
      num_inference_steps?: number;
      guidance_scale?: number;
      num_images?: number;
      enable_safety_checker?: boolean;
      output_format?: string;
      loras?: { path: string; scale: number }[];
    } | null;

    // Send a "processing" message
    const processingMsg = await ctx.reply("🎨 Generating your art...");

    // Log user parameters including LoRAs
    logger.info({ userParams, prompt }, "Starting generation with parameters");

    const response = await generateImage({
      telegramId: ctx.from.id.toString(),
      prompt,
      imageSize: userParams?.image_size,
      numInferenceSteps: userParams?.num_inference_steps,
      guidanceScale: userParams?.guidance_scale,
      numImages: userParams?.num_images,
      enableSafetyChecker: userParams?.enable_safety_checker,
      outputFormat: userParams?.output_format as 'jpeg' | 'png' | undefined,
      loras: userParams?.loras  // Add LoRA parameters
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
      imagesCount: response.images.length
    }, "Generation command completed successfully");

  } catch (error) {
    logger.error({
      messageId,
      chatId,
      error
    }, "Generation command failed");
    handleError(ctx, error);
  }
});

export default composer;