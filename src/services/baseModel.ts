import { PrismaClient, BaseModelType } from '@prisma/client';
import { logger } from '../lib/logger.js';

const prisma = new PrismaClient();

export const BASE_MODELS = {
  FLUX_LORA: {
    id: 'flux-lora',
    name: 'Flux Lora',
    version: 'v1.0',
    type: BaseModelType.FLUX,
    isDefault: true,
    falEndpoint: 'fal-ai/flux-lora'
  },
  FLUX_LORA_TRAINING: {
    id: 'flux-lora-fast-training',
    name: 'Flux Lora Training',
    version: 'v1.0',
    type: BaseModelType.FLUX,
    isDefault: false,
    falEndpoint: 'fal-ai/flux-lora-fast-training'
  }
} as const;

export class BaseModelService {
  static async ensureBaseModels() {
    try {
      // Check and create both models
      for (const model of Object.values(BASE_MODELS)) {
        const existingModel = await prisma.baseModel.findUnique({
          where: { id: model.id }
        });

        if (!existingModel) {
          await prisma.baseModel.create({
            data: {
              id: model.id,
              name: model.name,
              version: model.version,
              type: model.type,
              isDefault: model.isDefault
            }
          });
          logger.info(`Created base model: ${model.name}`);
        }
      }
      return true;
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to ensure base models');
      throw new Error(`Failed to ensure base models: ${error.message}`);
    }
  }

  static async getGenerationModel() {
    const model = await prisma.baseModel.findUnique({
      where: { id: BASE_MODELS.FLUX_LORA.id }
    });

    if (!model) {
      throw new Error('Generation model not found');
    }

    return model;
  }

  static async getTrainingModel() {
    const model = await prisma.baseModel.findUnique({
      where: { id: BASE_MODELS.FLUX_LORA_TRAINING.id }
    });

    if (!model) {
      throw new Error('Training model not found');
    }

    return model;
  }
}