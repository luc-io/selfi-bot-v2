import { Composer } from "grammy";
import { generateImage } from "../../services/generation.js";
import { hasSubscription } from "../middlewares/subscription.js";
import { handleError } from "../../utils/error.js";
import { BotContext } from "../../types/bot.js";
import { prisma } from "../../lib/prisma.js";
import { logger } from "../../lib/logger.js";

const composer = new Composer<BotContext>();

composer.command("gen", hasSubscription, async (ctx) => {
  try {
    // Get user parameters
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from?.id.toString() },
      include: { parameters: true }
    });

    // Extract parameters from user settings
    const userParams = user?.parameters?.params;
    logger.info({ 
      userParams,
      telegramId: ctx.from?.id
    }, 'Loaded user parameters for generation');

    const response = await generateImage({
      prompt: ctx.message?.text?.replace(/^\/gen\s+/, "") || "",
      // Map stored parameters to generation parameters
      imageSize: userParams?.image_size,
      numInferenceSteps: userParams?.num_inference_steps,
      guidanceScale: userParams?.guidance_scale,
      numImages: userParams?.num_images,
      enableSafetyChecker: userParams?.enable_safety_checker,
      outputFormat: userParams?.output_format as 'jpeg' | 'png' | undefined,
      seed: userParams?.seed,
    });

    await ctx.replyWithPhoto(response.images[0].url);
  } catch (error) {
    handleError(ctx, error);
  }
});

export default composer;