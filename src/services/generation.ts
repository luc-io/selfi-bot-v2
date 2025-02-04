import { fal } from '@fal-ai/client';
import { PrismaClient, Prisma } from '@prisma/client';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

// Initialize FAL client
fal.config({ credentials: config.FAL_KEY });

interface GenerationOptions {
  prompt: string;
  negativePrompt?: string;
  loraPath?: string;
  loraScale?: number;
  seed?: number;
}

type ImageSize = {
  width: number;
  height: number;
}

interface FalRequest {
  prompt: string;
  negative_prompt?: string;
  lora_path?: string;
  lora_scale?: number;
  seed?: number;
  image_size?: 'landscape_4_3' | 'portrait_4_3' | 'square' | ImageSize;
  num_inference_steps?: number;
  guidance_scale?: number;
}

interface GenerationParameters {
  num_inference_steps: number;
  guidance_scale: number;
  image_size?: string;
  enable_safety_checker?: boolean;
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
  static async generate(telegramId: string, options: GenerationOptions) {
    const { prompt, negativePrompt, loraPath, loraScale = 0.8, seed } = options;

    try {
      // First check user's stars balance using telegramId
      const user = await prisma.user.findUnique({
        where: { telegramId },
        select: {
          databaseId: true,
          stars: true,
          telegramId: true,
          parameters: true
        }
      });

      if (!user || user.stars < 1) {
        throw new Error('Insufficient stars balance');
      }

      let generatedImageUrl: string | null = null;
      let falRequestId: string | null = null;

      try {
        const userParams = user.parameters?.params as GenerationParameters | null;

        // Log the saved parameters
        logger.info({
          userParams,
          telegramId: user.telegramId
        }, 'User saved parameters');

        const generationParams: FalRequest = {
          prompt,
          negative_prompt: negativePrompt,
          lora_path: loraPath,
          lora_scale: loraScale,
          seed,
          image_size: (userParams?.image_size as 'landscape_4_3' | 'portrait_4_3' | 'square') ?? 'landscape_4_3',
          num_inference_steps: userParams?.num_inference_steps ?? 28,
          guidance_scale: userParams?.guidance_scale ?? 3.5,
        };

        // Log the final parameters being sent to FAL
        logger.info({
          generationParams,
          telegramId: user.telegramId
        }, 'Generation parameters being used');

        // Generate image using flux-lora model
        const falResult = await fal.subscribe('fal-ai/flux-lora', {
          input: generationParams,
          pollInterval: 1000,
          logs: true,
          onQueueUpdate: (update: { status: string; position?: number }) => {
            logger.info({ 
              status: update.status,
              position: update.position,
              prompt,
              telegramId: user.telegramId
            }, 'Generation queue update');
          },
        });

        // Log the full FAL response
        logger.info({ 
          falResponse: falResult,
          prompt,
          telegramId: user.telegramId 
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
            modelPath: 'fal-ai/flux-lora'
          }
        });

        if (!baseModel) {
          baseModel = await prisma.baseModel.create({
            data: {
              modelPath: 'fal-ai/flux-lora',
              costPerGeneration: 1
            }
          });
        }

        // Update database only if we have a valid image
        if (generatedImageUrl) {
          const metadata: Prisma.JsonObject = {
            falRequestId,
            inferenceTime: response.data.timings?.inference || null,
            hasNsfw: response.data.has_nsfw_concepts?.[0] || false,
            parameters: {
              num_inference_steps: generationParams.num_inference_steps,
              guidance_scale: generationParams.guidance_scale,
              lora_scale: generationParams.lora_scale,
              image_size: generationParams.image_size,
            }
          };

          await prisma.user.update({
            where: { telegramId },
            data: {
              stars: { decrement: 1 },
              generations: {
                create: {
                  baseModelId: baseModel.databaseId,
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
            parameters: metadata.parameters,
            telegramId: user.telegramId
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
          telegramId: user.telegramId
        }, 'FAL API Error');
        throw new Error(`Image generation failed: ${falError.message}`);
      }

    } catch (e: any) {
      const errorMessage = e.message || 'Unknown error';
      logger.error({ 
        error: errorMessage,
        prompt,
        telegramId
      }, 'Generation failed');
      throw new Error('Generation failed: ' + errorMessage);
    }
  }

  static async listUserGenerations(
    telegramId: string,
    limit = 10,
    offset = 0,
    lora?: { databaseId: string; baseModelId: string } | null
  ) {
    return prisma.generation.findMany({
      where: {
        user: { telegramId },
        ...(lora && {
          loraId: lora.databaseId,
          baseModelId: lora.baseModelId,
        }),
      },
      take: limit,
      skip: offset,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}