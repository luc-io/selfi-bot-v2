import { Composer } from "grammy";
import { generateImage } from "../../services/generation.js";
import { hasSubscription } from "../middlewares/subscription.js";
import { handleError } from "../../utils/error.js";
import { BotContext } from "../../types/bot.js";

const composer = new Composer<BotContext>();

composer.command("gen", hasSubscription, async (ctx) => {
  try {
    const response = await generateImage({
      prompt: ctx.message?.text?.replace(/^\/gen\s+/, "") || "",
    });

    await ctx.replyWithPhoto(response.images[0].url);
  } catch (error) {
    handleError(ctx, error);
  }
});

export default composer;