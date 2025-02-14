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
  loras?: Array<{
    triggerWord: string;
    scale: number;
  }>;
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
  return text.replace(/[—–]/g, '--');
}

function parseInlineParams(text: string): { prompt: string; params: InlineParams } {
  const normalizedText = normalizeCommandText(text);
  const parts = normalizedText.split(/\s+--/);
  const prompt = parts[0].split(/\/gen\s*/)[1]?.trim();
  const params: InlineParams = {
    loras: []
  };

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
        params.seed = parseInt(value);
        break;
      case 'n':
        params.n = parseInt(value);
        break;
      case 'l': {
        const [triggerWord, scale] = value.split(':');
        params.loras?.push({
          triggerWord,
          scale: parseFloat(scale) || 1
        });
        break;
      }
    }
  }

  return { prompt, params };
}

async function convertInlineToGenerationParams(
  inlineParams: InlineParams,
  userParams: Record<string, any> | null
): Promise<GenerationParams> {
  // Start with saved user parameters
  const baseParams: GenerationParams = {
    imageSize: userParams?.image_size,
    numInferenceSteps: userParams?.num_inference_steps,
    guidanceScale: userParams?.guidance_scale,
    numImages: userParams?.num_images,
    enableSafetyChecker: userParams?.enable_safety_checker,
    outputFormat: userParams?.output_format as 'jpeg' | 'png' | undefined,
    loras: userParams?.loras,
    // Use inline seed if provided, otherwise use saved seed
    seed: inlineParams.seed !== undefined ? inlineParams.seed : userParams?.seed
  };

  logger.info({ 
    inlineSeed: inlineParams.seed,
    savedSeed: userParams?.seed,
    finalSeed: baseParams.seed
  }, 'Processing seed parameter');

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

  if (inlineParams.loras && inlineParams.loras.length > 0) {
    // Find all LoRAs by trigger words
    const loraPromises = inlineParams.loras.map(async ({ triggerWord, scale }) => {
      const lora = await prisma.loraModel.findFirst({
        where: { triggerWord },
        select: { databaseId: true }
      });

      if (lora) {
        logger.info({ triggerWord, loraId: lora.databaseId, scale }, 'Found LoRA by trigger word');
        return {
          path: lora.databaseId,
          scale
        };
      } else {
        logger.warn({ triggerWord }, 'LoRA not found by trigger word');
        return null;
      }
    });

    const resolvedLoras = (await Promise.all(loraPromises)).filter((lora): lora is { path: string; scale: number } => lora !== null);
    
    if (resolvedLoras.length > 0) {
      baseParams.loras = resolvedLoras;
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
    await ctx.reply(`❌ Por favor escribe un prompt después del comando /gen.\nEjemplo: /gen a beautiful sunset --ar 16:9 --s 28 --c 3.5 --l trigger_word:1.7 --l another_lora:0.8\n\nParámetros:\n--ar: Relación de aspecto (16:9, 1:1)\n--s: Pasos (predeterminado: 28)\n--c: Escala CFG (predeterminado: 3.5)\n--seed: Valor de semilla\n--n: Número de imágenes\n--l: Palabra clave de LoRA y escala (puede usarse varias veces, formato: trigger_word:1.7)`);
    return;
  }

  if (!ctx.from?.id) {
    await ctx.reply("No se pudo identificar al usuario");
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

    logger.info({ 
      userParams: userParams,
      generationParams: generationParams,
      inlineSeed: params.seed,
      savedSeed: userParams?.seed,
      finalSeed: generationParams.seed,
      prompt 
    }, "Starting generation with parameters");

    const processingMsg = await ctx.reply("🎨 Generando tu arte...");

    const response = await generateImage({
      telegramId: ctx.from.id.toString(),
      prompt,
      ...generationParams
    });

    await ctx.api.deleteMessage(chatId, processingMsg.message_id);

    if (response.images.length === 1) {
      await ctx.replyWithPhoto(response.images[0].url);
    } else {
      const mediaGroup = response.images.map(image => 
        InputMediaBuilder.photo(image.url)
      );
      await ctx.replyWithMediaGroup(mediaGroup);
    }

    logger.info({ 
      messageId, 
      chatId, 
      imagesCount: response.images.length,
      usedSeed: generationParams.seed,
      resultSeed: response.seed
    }, "Generation command completed successfully");

  } catch (error) {
    logger.error({ messageId, chatId, error }, "Generation command failed");
    handleError(ctx, error);
  }
});

export default composer;