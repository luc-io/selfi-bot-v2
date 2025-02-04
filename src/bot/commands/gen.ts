import { Bot } from "grammy";
import { PrismaClient } from "@prisma/client";
import { generateImage } from "../../services/generation.js";
import { hasSubscription } from "../middlewares/subscription.js";
import { handleError } from "../../utils/error.js";
import { CommandContext } from "../../types/bot.js";

export default function setupGenCommand(bot: Bot, prisma: PrismaClient) {
  bot.command("gen", hasSubscription, async (ctx: CommandContext) => {
    try {
      const response = await generateImage({
        prompt: ctx.message?.text || "",
      });

      await ctx.replyWithPhoto(response.images[0].url);
    } catch (error) {
      handleError(ctx, error);
    }
  });
}