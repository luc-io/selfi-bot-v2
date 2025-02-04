import { Context, SessionFlavor } from "grammy";

interface SessionData {
  // Add session data here if needed
}

export type BotContext = Context & SessionFlavor<SessionData>;
export type CommandContext = BotContext;