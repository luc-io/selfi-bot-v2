import { Context as GrammyContext } from 'grammy';
import { PrismaClient } from '@prisma/client';

interface SessionData {
  // Add your session data here
}

export interface Context extends GrammyContext {
  db: PrismaClient;
  session: SessionData;
}