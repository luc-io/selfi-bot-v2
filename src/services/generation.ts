import { fal } from '@fal-ai/client';
import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

// Initialize FAL client
fal.config({ credentials: config.FAL_KEY });

const prisma = new PrismaClient();

interface GenerationOptions {
  prompt: string;
  negativePrompt?: string;
  loraPath?: string;
  loraScale?: number;
  seed?: number;
}

interface FalRequest {
  prompt: string;
  negative_prompt?: string;
  lora_path?: string;
  lora_scale?: number;
  seed?: number;
  image_size?: 'landscape_4_3' | 'portrait_4_3' | 'square' | { width: number; height: number };
  num_inference_steps?: number;
  guidance_scale?: number;
}

interface FalResponse {
  data: {
    images: Array<{
      url: string;
      width: number;
      height: number;
      content_type: string;
    }>;
    prompt: string;
    timings: {
      inference: number;
    };
    seed: number;
    has_nsfw_concepts: boolean[];
  };
  requestId: string;
}

export class GenerationService {
  static async generate(userId: string, options: GenerationOptions) {
    const { prompt, negativePrompt, loraPath, loraScale = 0.8, seed } = options;

    try {
      // First check user's stars balance and get telegramId
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          stars: true,
          telegramId: true,
          parameters: true  // Include user parameters
        }
      });

      if (!user || user.stars < 1) {
        throw new Error('Insufficient stars balance');
      }

      let generatedImageUrl: string | null = null;
      let falRequestId: string | null = null;

      try {
        // Get user parameters or use defaults
        const userParams = user.parameters?.params || {};
        const requestParams = {
          prompt,
          negative_prompt: negativePrompt,
          lora_path: loraPath,
          lora_scale: loraScale,
          seed,
          ...userParams
        };

        // Log the request parameters
        logger.info({ 
          userId: user.telegramId,
          requestParams,
          prompt,
          seed
        }, 'Starting generation with parameters');

        // Generate image using flux-lora model
        const falResult = await fal.subscribe('fal-ai/flux-lora', {
          input: requestParams as FalRequest,
          pollInterval: 1000,
          logs: true,
          onQueueUpdate: (update: { status: string; position?: number }) => {
            logger.info({ 
              status: update.status,
              position: update.position,
              prompt,
              userId: user.telegramId
            }, 'Generation queue update');
          },
        });

        const response = falResult as unknown as FalResponse;
        falRequestId = response.requestId;

        // Log the full response including the seed that was used
        logger.info({ 
          requestId: falRequestId,
          prompt,
          requestedSeed: seed,
          usedSeed: response.data.seed,
          userId: user.telegramId 
        }, 'Generation completed with seed');
        
        if (!response?.data?.images?.length) {
          throw new Error('No images in response');
        }

        generatedImageUrl = response.data.images[0].url;

        // Get or create the base model
        let baseModel = await prisma.baseModel.findFirst({
          where: {
            name: 'Flux',
            type: 'FLUX',
            isDefault: true
          }
        });

        if (!baseModel) {
          baseModel = await prisma.baseModel.create({
            data: {
              name: 'Flux',
              version: 'v1',
              type: 'FLUX',
              isDefault: true
            }
          });
        }

        // Update database only if we have a valid image
        if (generatedImageUrl) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              stars: { decrement: 1 },
              generations: {
                create: {
                  baseModelId: baseModel.id,
                  prompt,
                  negativePrompt,
                  imageUrl: generatedImageUrl,
                  seed: response.data.seed ? BigInt(response.data.seed) : null,
                  starsUsed: 1,
                  metadata: {
                    falRequestId,
                    inferenceTime: response.data.timings?.inference,
                    hasNsfw: response.data.has_nsfw_concepts?.[0] || false,
                    requestedSeed: seed,  // Store requested seed
                    usedSeed: response.data.seed  // Store actual seed used
                  }
                }
              }
            }
          });

          logger.info({ 
            imageUrl: generatedImageUrl,
            prompt,
            falRequestId,
            requestedSeed: seed,
            usedSeed: response.data.seed,
            timing: response.data.timings?.inference,
            userId: user.telegramId
          }, 'Image saved with seed information');

          return { imageUrl: generatedImageUrl };
        } else {
          throw new Error('Failed to get image URL from response');
        }

      } catch (falError: any) {
        logger.error({ 
          error: falError.message,
          prompt,
          falRequestId,
          userId: user.telegramId
        }, 'FAL API Error');
        throw new Error(`Image generation failed: ${falError.message}`);
      }

    } catch (e: any) {
      const errorMessage = e.message || 'Unknown error';
      logger.error({ 
        error: errorMessage,
        prompt,
        userId 
      }, 'Generation failed');
      throw new Error('Generation failed: ' + errorMessage);
    }
  }

  static async listUserGenerations(
    userId: string,
    limit = 10,
    offset = 0,
    lora?: { id: string; baseModelId: string } | null
  ) {
    return prisma.generation.findMany({
      where: {
        userId,
        ...(lora
          ? {
              loraId: lora.id,
              baseModelId: lora.baseModelId,
            }
          : {}),
      },
      take: limit,
      skip: offset,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}