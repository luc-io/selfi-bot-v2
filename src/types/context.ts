import { Context, SessionFlavor } from 'grammy';

export interface SessionData {
  // Add your session data properties here
}

export type BotContext = Context & SessionFlavor<SessionData>;