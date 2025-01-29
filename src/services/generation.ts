import { fal } from '@fal-ai/serverless';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

interface GenerationConfig {
  userId: string;
  baseModelId: string;
  loraId?: string;
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  starsRequired: number;
}

export class GenerationService {
  private async generateWithFal(config: {
    prompt: string;
    negativePrompt?: string;
    loraPath?: string;
    loraScale?: number;
    seed?: number;
  }) {
    try {
      const genLogger = logger.child({ service: 'fal', prompt: config.prompt });
      genLogger.debug('Starting generation with FAL');

      const result = await fal.subscribe('fal-ai/flux', {
        input: {
          prompt: config.prompt,
          negative_prompt: config.negativePrompt,
          loras: config.loraPath ? [{
            path: config.loraPath,
            scale: config.loraScale || 0.8
          }] : undefined,
          image_size: "landscape_16_9",
          num_inference_steps: 30,
          guidance_scale: 7.5,
          num_images: 1,
          seed: config.seed || Math.floor(Math.random() * 1000000)
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            genLogger.debug({ progress: update.logs }, 'Generation progress');
          }
        }
      });

      if (!result.data?.images?.[0]?.url) {
        throw new Error('No image generated');
      }

      return {
        imageUrl: result.data.images[0].url,
        seed: config.seed
      };
    } catch (error) {
      logger.error('FAL generation error:', error);
      throw new Error('Failed to generate image');
    }
  }

  async generateImage(config: GenerationConfig) {
    const genLogger = logger.child({ 
      userId: config.userId,
      baseModelId: config.baseModelId,
      loraId: config.loraId
    });

    genLogger.debug('Starting image generation');

    return await prisma.$transaction(async (tx) => {
      // Check stars balance
      const user = await tx.user.findUnique({
        where: { id: config.userId },
        select: { stars: true }
      });

      if (!user || user.stars < config.starsRequired) {
        throw new Error('Insufficient stars');
      }

      // Get models
      const baseModel = await tx.baseModel.findUnique({
        where: { id: config.baseModelId }
      });

      if (!baseModel) {
        throw new Error('Base model not found');
      }

      let lora = null;
      if (config.loraId) {
        lora = await tx.loraModel.findUnique({
          where: { id: config.loraId }
        });
        if (!lora || !lora.weightsUrl) {
          throw new Error('LoRA model not found or not ready');
        }
      }

      // Generate image
      const { imageUrl, seed } = await this.generateWithFal({
        prompt: config.prompt,
        negativePrompt: config.negativePrompt,
        loraPath: lora?.weightsUrl,
        seed: config.seed
      });

      // Deduct stars and create generation record
      const [generation] = await Promise.all([
        tx.generation.create({
          data: {
            userId: config.userId,
            baseModelId: config.baseModelId,
            loraId: config.loraId,
            prompt: config.prompt,
            negativePrompt: config.negativePrompt,
            imageUrl,
            seed: seed ? BigInt(seed) : null,
            starsUsed: config.starsRequired
          }
        }),
        tx.user.update({
          where: { id: config.userId },
          data: {
            stars: { decrement: config.starsRequired },
            totalSpentStars: { increment: config.starsRequired }
          }
        })
      ]);

      genLogger.info({ generationId: generation.id }, 'Generation completed');

      return generation;
    });
  }
}

export const generationService = new GenerationService();