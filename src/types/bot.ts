import { Context, SessionFlavor } from 'grammy';
import { SessionData } from './interfaces';

export type BotContext = Context & SessionFlavor<SessionData>;