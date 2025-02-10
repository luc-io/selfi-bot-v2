import { Composer, InputMediaBuilder } from "grammy";
import { generateImage } from "../../services/generation.js";
import { hasSubscription } from "../middlewares/subscription.js";
import { handleError } from "../../utils/error.js";
import { BotContext } from "../../types/bot.js";
import { prisma } from "../../lib/prisma.js";
import { logger } from "../../lib/logger.js";

const composer = new Composer<BotContext>();

interface InlineParams {
  ar?: string;
  s?: number;
  c?: number;
  seed?: number;
  n?: number;
  l?: string;
}

interface GenerationParams {
  imageSize?: string;
  numInferenceSteps?: number;
  guidanceScale?: number;
  numImages?: number;
  enableSafetyChecker?: boolean;
  outputFormat?: 'jpeg' | 'png';
  loras?: { path: string; scale: number }[];
  seed?: number;
}

function parseInlineParams(text: string): { prompt: string; params: InlineParams } {
  const parts = text.split(/\s+--/);
  const prompt = parts[0].split(/\/gen\s*/)[1]?.trim();
  const params: InlineParams = {};

  for (let i = 1; i < parts.length; i++) {
    const [key, value] = parts[i].split(/\s+/);
    switch (key) {
      case 'ar':
        params.ar = value;
        break;
      case 's':
        params.s = parseInt(value);
        break;
      case 'c':
        params.c = parseFloat(value);
        break;
      case 'seed':
        params.seed = parseInt(value);
        break;
      case 'n':
        params.n = parseInt(value);
        break;
      case 'l':
        params.l = value;
        break;
    }
  }

  return { prompt, params };
}

function convertInlineToGenerationParams(
  inlineParams: InlineParams,
  userParams: Record<string, any> | null
): GenerationParams {
  const baseParams: GenerationParams = {
    imageSize: userParams?.image_size,
    numInferenceSteps: userParams?.num_inference_steps,
    guidanceScale: userParams?.guidance_scale,
    numImages: userParams?.num_images,
    enableSafetyChecker: userParams?.enable_safety_checker,
    outputFormat: userParams?.output_format as 'jpeg' | 'png' | undefined,
    loras: userParams?.loras,
    seed: undefined
  };

  if (inlineParams.ar) {
    const [width, height] = inlineParams.ar.split(':');
    if (width === '16' && height === '9') {
      baseParams.imageSize = 'portrait_16_9';
    } else if (width === '1' && height === '1') {
      baseParams.imageSize = 'square';
    }
  }

  if (inlineParams.s) baseParams.numInferenceSteps = inlineParams.s;
  if (inlineParams.c) baseParams.guidanceScale = inlineParams.c;
  if (inlineParams.seed) baseParams.seed = inlineParams.seed;
  if (inlineParams.n) baseParams.numImages = inlineParams.n;

  if (inlineParams.l) {
    const [loraId, scale] = inlineParams.l.split(':');
    baseParams.loras = [{
      path: loraId,
      scale: parseFloat(scale) || 1
    }];
  }

  return baseParams;
}

// Store the last processed command for each chat
const lastProcessed = new Map<number, { msgId: number; timestamp: number }>();

composer.command("gen", hasSubscription, async (ctx) => {
  // Ensure this is a text message with the command
  if (!ctx.message?.text) {
    return;
  }

  // Parse inline parameters
  const { prompt, params } = parseInlineParams(ctx.message.text);
  
  // Check for empty or missing prompt
  if (!prompt) {
    await ctx.reply("❌ Please provide a prompt after the /gen command.\nExample: /gen a beautiful sunset --ar 16:9 --s 28 --c 3.5");
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
      command: ctx.message.text,
      parsedParams: params
    }, "Starting generation command");

    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from.id.toString() },
      include: { parameters: true }
    });

    const userParams = user?.parameters?.params as Record<string, any> | null;

    // Convert inline parameters to generation parameters
    const generationParams = convertInlineToGenerationParams(params, userParams);

    // Send a "processing" message
    const processingMsg = await ctx.reply("🎨 Generating your art...");

    // Log user parameters including LoRAs
    logger.info({ userParams: generationParams, prompt }, "Starting generation with parameters");

    const response = await generateImage({
      telegramId: ctx.from.id.toString(),
      prompt,
      ...generationParams
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