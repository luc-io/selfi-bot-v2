import { Composer, InputMediaBuilder } from "grammy";
import { generateImage } from "../../services/generation.js";
import { hasSubscription } from "../middlewares/subscription.js";
import { handleError } from "../../utils/error.js";
import { BotContext } from "../../types/bot.js";
import { prisma } from "../../lib/prisma.js";
import { logger } from "../../lib/logger.js";
import { compressLongSeed, generateFalSeed } from "../../utils/seed.js";

const composer = new Composer<BotContext>();
const MAX_SEED = 9999999;

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

function normalizeCommandText(text: string): string {
  return text.replace(/[\u2014\u2013]/g, '--');
}

function parseInlineParams(text: string): { prompt: string; params: InlineParams } {
  const normalizedText = normalizeCommandText(text);
  const parts = normalizedText.split(/\s+--/);
  const prompt = parts[0].split(/\/gen\s+/)[1]?.trim();
  const params: InlineParams = {};

  logger.info({ originalText: text, normalizedText, parts }, 'Parsing inline parameters');

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
        const seedValue = parseInt(value);
        params.seed = seedValue <= MAX_SEED ? seedValue : seedValue % MAX_SEED;
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

async function convertInlineToGenerationParams(
  inlineParams: InlineParams,
  userParams: Record<string, any> | null
): Promise<GenerationParams> {
  const baseParams: GenerationParams = {
    imageSize: userParams?.image_size,
    numInferenceSteps: userParams?.num_inference_steps,
    guidanceScale: userParams?.guidance_scale,
    numImages: userParams?.num_images,
    enableSafetyChecker: userParams?.enable_safety_checker,
    outputFormat: userParams?.output_format as 'jpeg' | 'png' | undefined,
    loras: userParams?.loras,
    seed: inlineParams.seed || generateFalSeed()
  };

  if (inlineParams.ar) {
    const [width, height] = inlineParams.ar.split(':');
    if (width === '16' && height === '9') {
      baseParams.imageSize = 'portrait_16_9';
    } else if (width === '1' && height === '1') {
      baseParams.imageSize = 'square';
    }
    logger.info({ ar: inlineParams.ar, width, height, resultSize: baseParams.imageSize }, 'Processed aspect ratio parameter');
  }

  if (inlineParams.s) baseParams.numInferenceSteps = inlineParams.s;
  if (inlineParams.c) baseParams.guidanceScale = inlineParams.c;
  if (inlineParams.n) baseParams.numImages = inlineParams.n;

  if (inlineParams.l) {
    const [triggerWord, scale] = inlineParams.l.split(':');
    // Find LoRA by trigger word
    const lora = await prisma.loraModel.findFirst({
      where: { triggerWord },
      select: { databaseId: true }
    });

    if (lora) {
      baseParams.loras = [{
        path: lora.databaseId,
        scale: parseFloat(scale) || 1
      }];
      logger.info({ triggerWord, loraId: lora.databaseId, scale }, 'Found LoRA by trigger word');
    } else {
      logger.warn({ triggerWord }, 'LoRA not found by trigger word');
    }
  }

  return baseParams;
}

// Store the last processed command for each chat
const lastProcessed = new Map<number, { msgId: number; timestamp: number }>();

composer.command("gen", hasSubscription, async (ctx) => {
  if (!ctx.message?.text) return;

  const { prompt, params } = parseInlineParams(ctx.message.text);
  
  if (!prompt) {
    await ctx.reply(`\u274c Please provide a prompt after the /gen command.
Example: /gen a beautiful sunset --ar 16:9 --s 28 --c 3.5 --l <trigger_word>:1.7

Parameters:
--ar: Aspect ratio (16:9, 1:1)
--s: Steps (default: 28)
--c: CFG Scale (default: 3.5)
--seed: Seed value (7 digits max)
--n: Number of images
--l: LoRA trigger word and scale (format: trigger_word:1.7)`);
    return;
  }

  if (!ctx.from?.id) {
    await ctx.reply("Could not identify user");
    return;
  }

  const chatId = ctx.chat.id;
  const messageId = ctx.message.message_id;
  const now = Date.now();

  const last = lastProcessed.get(chatId);
  if (last) {
    if (messageId === last.msgId) {
      logger.info({ chatId, messageId, lastMsgId: last.msgId, timeDiff: now - last.timestamp }, "Skipping duplicate command");
      return;
    }
    if (now - last.timestamp < 5000) {
      logger.info({ chatId, messageId, lastMsgId: last.msgId, timeDiff: now - last.timestamp }, "Command too soon after last one");
      return;
    }
  }

  lastProcessed.set(chatId, { msgId: messageId, timestamp: now });

  setTimeout(() => {
    const entry = lastProcessed.get(chatId);
    if (entry?.msgId === messageId) {
      lastProcessed.delete(chatId);
    }
  }, 60000);

  try {
    logger.info({ messageId, chatId, command: ctx.message.text, parsedParams: params }, "Starting generation command");

    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from.id.toString() },
      include: { parameters: true }
    });

    const userParams = user?.parameters?.params as Record<string, any> | null;
    const generationParams = await convertInlineToGenerationParams(params, userParams);
    const processingMsg = await ctx.reply("\ud83c\udfa8 Generating your art...");

    logger.info({ userParams: generationParams, prompt }, "Starting generation with parameters");

    const response = await generateImage({
      telegramId: ctx.from.id.toString(),
      prompt,
      ...generationParams
    });

    const imagesWithSeeds = response.images.map(img => ({
      ...img,
      seed: compressLongSeed(response.seed)
    }));

    await ctx.api.deleteMessage(chatId, processingMsg.message_id);

    if (imagesWithSeeds.length === 1) {
      await ctx.replyWithPhoto(imagesWithSeeds[0].url);
    } else {
      const mediaGroup = imagesWithSeeds.map(image => 
        InputMediaBuilder.photo(image.url)
      );
      await ctx.replyWithMediaGroup(mediaGroup);
    }

    logger.info({ messageId, chatId, imagesCount: response.images.length }, "Generation command completed successfully");

  } catch (error) {
    logger.error({ messageId, chatId, error }, "Generation command failed");
    handleError(ctx, error);
  }
});

export default composer;