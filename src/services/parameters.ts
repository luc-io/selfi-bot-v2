import { PrismaClient } from '@prisma/client';
import { logger } from '../lib/logger.js';

const prisma = new PrismaClient();

interface SaveParametersOptions {
  userId: string;
  model: any;
  params: any;
}

export class ParametersService {
  static async saveParameters({ userId, model, params }: SaveParametersOptions) {
    try {
      logger.debug({ userId, model, params }, 'Saving user parameters');

      const result = await prisma.userParameters.upsert({
        where: { userId },
        update: {
          model,
          params,
          updatedAt: new Date()
        },
        create: {
          userId,
          model,
          params
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