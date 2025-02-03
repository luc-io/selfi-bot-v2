import { fal } from '@fal-ai/client';
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
  image_size?: string;
  num_inference_steps?: number;
  guidance_scale?: number;
  num_images?: number;
  sync_mode?: boolean;
  enable_safety_checker?: boolean;
  output_format?: 'jpeg' | 'png';
}

interface FalRequest {
  prompt: string;
  negative_prompt?: string;
  lora_path?: string;
  lora_scale?: number;
  seed?: number;
  image_size?: string;
  num_inference_steps?: number;
  guidance_scale?: number;
  output_format?: string;
  sync_mode?: boolean;
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

const defaultParams = {
  image_size: 'landscape_4_3',
  num_inference_steps: 28,
  guidance_scale: 3.5,
  num_images: 1,
  sync_mode: false,
  enable_safety_checker: true,
  output_format: 'jpeg'
};

export class GenerationService {
  static async generate(telegramId: string, options: GenerationOptions) {
    const { prompt, negativePrompt, loraPath, loraScale = 0.8 } = options;

    try {
      // First check user's stars balance and get saved parameters
      const user = await prisma.user.findUnique({
        where: { telegramId },
        include: {
          parameters: true
        }
      });

      if (!user || user.stars < 1) {
        throw new Error('Insufficient stars balance');
      }

      // Get user's saved parameters or use defaults
      const savedParams = user.parameters?.params || {};
      const generationParams = {
        ...defaultParams,
        ...savedParams,
        prompt,
        negative_prompt: negativePrompt,
        lora_path: loraPath,
        lora_scale: loraScale,
      };

      let generatedImageUrl: string | null = null;
      let falRequestId: string | null = null;

      try {
        // Generate image using flux-lora model with parameters
        const falResult = await fal.subscribe('fal-ai/flux-lora', {
          input: generationParams as FalRequest,
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
                  seed: options.seed ? BigInt(options.seed) : null,
                  starsUsed: 1,
                  metadata: {
                    falRequestId,
                    inferenceTime: response.data.timings?.inference,
                    hasNsfw: response.data.has_nsfw_concepts?.[0] || false,
                    parameters: {
                      image_size: generationParams.image_size,
                      num_inference_steps: generationParams.num_inference_steps,
                      guidance_scale: generationParams.guidance_scale,
                      num_images: generationParams.num_images,
                      sync_mode: generationParams.sync_mode,
                      enable_safety_checker: generationParams.enable_safety_checker,
                      output_format: generationParams.output_format
                    }
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
            telegramId: user.telegramId,
            parameters: generationParams
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
          telegramId: user.telegramId,
          parameters: generationParams
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
        ...(lora
          ? {
              loraId: lora.databaseId,
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