import { fal } from '@fal-ai/client';
import { PrismaClient, Prisma } from '@prisma/client';
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
  num_images?: number;
}

interface GenerationParams extends Prisma.JsonObject {
  image_size?: 'landscape_4_3' | 'portrait_4_3' | 'square';
  num_inference_steps?: number;
  guidance_scale?: number;
  num_images?: number;
  [key: string]: Prisma.JsonValue | undefined;
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

// Default parameters if none are saved
const DEFAULT_PARAMS: GenerationParams = {
  image_size: 'landscape_4_3',
  num_inference_steps: 28,
  guidance_scale: 3.5,
  num_images: 1,
};

export class GenerationService {
  static async generate(userId: string, options: GenerationOptions) {
    const { prompt, negativePrompt, loraPath, loraScale = 0.8, seed } = options;

    try {
      // First check user's stars balance and get telegramId, and parameters
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          stars: true,
          telegramId: true,
          parameters: true  // Include saved parameters
        }
      });

      if (!user || user.stars < 1) {
        throw new Error('Insufficient stars balance');
      }

      // Get user's saved parameters or use defaults
      const userParams = user.parameters?.params as GenerationParams || {};
      const generationParams: GenerationParams = {
        ...DEFAULT_PARAMS,
        ...userParams,
      };

      // Log the parameters being used
      logger.info({
        userId: user.telegramId,
        userParams,
        finalParams: generationParams
      }, 'Using generation parameters');

      let generatedImageUrl: string | null = null;
      let falRequestId: string | null = null;

      try {
        // Generate image using flux-lora model with user parameters
        const falResult = await fal.subscribe('fal-ai/flux-lora', {
          input: {
            prompt,
            negative_prompt: negativePrompt,
            lora_path: loraPath,
            lora_scale: loraScale,
            seed,
            ...generationParams  // Use saved or default parameters
          } as FalRequest,
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

        // Log the full FAL response
        logger.info({ 
          falResponse: falResult,
          prompt,
          userId: user.telegramId 
        }, 'FAL API Response');

        const response = falResult as unknown as FalResponse;
        falRequestId = response.requestId;
        
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
          const metadata: Prisma.JsonObject = {
            falRequestId: falRequestId || '',
            inferenceTime: response.data.timings?.inference || null,
            hasNsfw: response.data.has_nsfw_concepts?.[0] || false,
            params: {...generationParams}
          };

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
                  seed: seed ? BigInt(seed) : null,
                  starsUsed: 1,
                  metadata
                }
              }
            }
          });

          logger.info({ 
            imageUrl: generatedImageUrl,
            prompt,
            falRequestId,
            timing: response.data.timings?.inference,
            userId: user.telegramId,
            params: generationParams
          }, 'Generation succeeded');

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