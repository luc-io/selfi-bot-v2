import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../lib/logger.js';
import type { UserParameters } from '../types/params.js';

const prisma = new PrismaClient();

interface SaveParametersOptions extends UserParameters {
  userId: string;
}

export class ParametersService {
  static async saveParameters({ userId, model, params }: SaveParametersOptions) {
    try {
      logger.debug({ userId, model, params }, 'Saving user parameters');

      const result = await prisma.userParameters.upsert({
        where: { userId },
        update: {
          model: model as unknown as Prisma.JsonValue,
          params: params as unknown as Prisma.JsonValue,
          updatedAt: new Date()
        },
        create: {
          userId,
          model: model as unknown as Prisma.JsonValue,
          params: params as unknown as Prisma.JsonValue
        }
      });

      logger.info({ userId }, 'User parameters saved successfully');
      return result;

    } catch (error) {
      logger.error({ error, userId }, 'Failed to save user parameters');
      throw error;
    }
  }

  static async getParameters(userId: string) {
    try {
      logger.debug({ userId }, 'Getting user parameters');

      const parameters = await prisma.userParameters.findUnique({
        where: { userId }
      });

      logger.info({ userId, found: !!parameters }, 'User parameters retrieved');
      return parameters;

    } catch (error) {
      logger.error({ error, userId }, 'Failed to get user parameters');
      throw error;
    }
  }
}