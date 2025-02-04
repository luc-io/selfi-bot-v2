import { NextFunction } from "grammy";
import { CommandContext } from "../../types/bot";

export async function hasSubscription(ctx: CommandContext, next: NextFunction) {
  // TODO: Implement subscription check
  return next();
}