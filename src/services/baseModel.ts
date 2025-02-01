import { PrismaClient, BaseModelType } from '@prisma/client';
import { logger } from '../lib/logger.js';

const prisma = new PrismaClient();

export class BaseModelService {
  static async ensureDefaultBaseModel() {
    try {
      // Check if default model exists
      const existingModel = await prisma.baseModel.findUnique({
        where: { id: 'flux-default' }
      });

      if (!existingModel) {
        // Create default model if it doesn't exist
        await prisma.baseModel.create({
          data: {
            id: 'flux-default',
            name: 'Flux',
            version: 'v1.0',
            type: BaseModelType.FLUX,
            isDefault: true
          }
        });
        logger.info('Created default base model');
      }

      return true;
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to ensure default base model');
      throw new Error(`Failed to ensure default base model: ${error.message}`);
    }
  }

  static async getDefaultBaseModel() {
    const model = await prisma.baseModel.findFirst({
      where: { isDefault: true }
    });

    if (!model) {
      throw new Error('No default base model found');
    }

    return model;
  }
}
