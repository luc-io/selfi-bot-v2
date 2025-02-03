import { Context, SessionFlavor } from 'grammy';
import { User } from '@prisma/client';

interface SessionData {
  userId?: string;
}

export type BotContext = Context & SessionFlavor<SessionData>;