import { fal } from '@fal-ai/client';
import { PrismaClient, Prisma } from '@prisma/client';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { ParametersService } from './parameters.js';
import type { GenerationParams } from '../types/params.js';

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

interface FalRequest extends GenerationParams {
  prompt: string;
  negative_prompt?: string;
  lora_path?: string;
  lora_scale?: number;
  seed?: number;
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

const DEFAULT_BASE_MODEL_ID = 'flux-default';
const DEFAULT_PARAMS: GenerationParams = {
  image_size: 'landscape_4_3',
  num_inference_steps: 28,
  guidance_scale: 3.5,
  num_images: 1,
  sync_mode: false,
  enable_safety_checker: true,
  output_format: 'jpeg'
};

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
          telegramId: true
        }
      });

      if (!user || user.stars < 1) {
        throw new Error('Insufficient stars balance');
      }

      // Get user's saved parameters
      const userConfig = await ParametersService.getParameters(user.id);
      logger.info({ userConfig }, 'Retrieved user parameters for generation');

      let generatedImageUrl: string | null = null;
      let falRequestId: string | null = null;

      try {
        // Parse saved params or use defaults
        const savedParams = userConfig?.params ? 
          (userConfig.params as unknown as GenerationParams) : 
          {};

        // Use saved parameters or defaults
        const generationParams: FalRequest = {
          ...DEFAULT_PARAMS,
          ...savedParams,
          prompt,
          negative_prompt: negativePrompt,
          lora_path: loraPath,
          lora_scale: loraScale,
          seed: seed || Math.floor(Math.random() * 1000000)
        };

        logger.info({ generationParams }, 'Using generation parameters');

        // Generate image
        const falResult = await fal.subscribe('fal-ai/flux-lora', {
          input: generationParams,
          pollInterval: 1000,
          logs: true,
          onQueueUpdate: (update: { status: string; position?: number }) => {
            logger.info({ 
              status: update.status,
              position: update.position,
              prompt,
              userId: user.telegramId,
              params: generationParams
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

        // Update database only if we have a valid image
        if (generatedImageUrl) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              stars: { decrement: 1 },
              generations: {
                create: {
                  baseModelId: DEFAULT_BASE_MODEL_ID,
                  prompt,
                  negativePrompt,
                  imageUrl: generatedImageUrl,
                  seed: seed ? BigInt(seed) : null,
                  starsUsed: 1,
                  metadata: {
                    falRequestId,
                    inferenceTime: response.data.timings?.inference,
                    hasNsfw: response.data.has_nsfw_concepts?.[0] || false,
                    params: generationParams as unknown as Prisma.JsonValue
                  }
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