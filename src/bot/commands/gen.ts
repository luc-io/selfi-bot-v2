import { Composer, InputMediaBuilder } from "grammy";
import { generateImage } from "../../services/generation.js";
import { hasSubscription } from "../middlewares/subscription.js";
import { handleError } from "../../utils/error.js";
import { BotContext } from "../../types/bot.js";
import { prisma } from "../../lib/prisma.js";

const composer = new Composer<BotContext>();

composer.command("gen", hasSubscription, async (ctx) => {
  try {
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

    const response = await generateImage({
      prompt: ctx.message?.text?.replace(/^\/gen\s+/, "") || "",
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
  } catch (error) {
    handleError(ctx, error);
  }
});

export default composer;