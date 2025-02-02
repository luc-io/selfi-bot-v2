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

interface GenerationResult {
  imageUrl: string;
  seed: number;
}

interface UserParams {
  image_size?: string;
  num_inference_steps?: number;
  guidance_scale?: number;
  num_images?: number;
  enable_safety_checker?: boolean;
  output_format?: string;
  [key: string]: any;
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

function normalizeSeed(seed: number): number {
  return seed % 10000000;  // Keep only the last 7 digits
}

export class GenerationService {
  static async generate(userId: string, options: GenerationOptions): Promise<GenerationResult> {
    const { prompt, negativePrompt, loraPath, loraScale = 0.8, seed } = options;

    try {
      // First check user's stars balance and get telegramId
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          stars: true,
          telegramId: true,
          parameters: true  // Include parameters to get user settings
        }
      });

      if (!user || user.stars < 1) {
        throw new Error('Insufficient stars balance');
      }

      let generatedImageUrl: string | null = null;
      let falRequestId: string | null = null;
      let generatedSeed: number | null = null;

      try {
        // Get user parameters or use defaults
        const userParams = (user.parameters?.params || {}) as UserParams;
        const requestParams = {
          prompt,
          negative_prompt: negativePrompt,
          lora_path: loraPath,
          lora_scale: loraScale,
          seed,
          ...userParams
        };

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
        generatedSeed = normalizeSeed(response.data.seed);  // Normalize the seed

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
        if (generatedImageUrl && generatedSeed !== null) {
          try {
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
                    seed: generatedSeed ? BigInt(generatedSeed) : null,
                    starsUsed: 1,
                    metadata: {
                      falRequestId,
                      inferenceTime: response.data.timings?.inference,
                      hasNsfw: response.data.has_nsfw_concepts?.[0] || false
                    }
                  }
                }
              }
            });
          } catch (dbError) {
            // Log database error but don't fail the request
            logger.error({
              error: dbError,
              prompt,
              generatedSeed,
              userId: user.telegramId
            }, 'Database update failed but image was generated');
          }

          logger.info({ 
            imageUrl: generatedImageUrl,
            prompt,
            seed: generatedSeed,
            falRequestId,
            timing: response.data.timings?.inference,
            userId: user.telegramId
          }, 'Generation succeeded');

          return { 
            imageUrl: generatedImageUrl,
            seed: generatedSeed
          };
        } else {
          throw new Error('Failed to get image URL or seed from response');
        }

      } catch (falError: any) {
        // If we got the image but had other errors, still return the image
        if (generatedImageUrl && generatedSeed !== null) {
          logger.error({ 
            error: falError.message,
            prompt,
            falRequestId,
            userId: user.telegramId,
            detail: "API error but image was generated"
          }, 'Partial generation success');
          
          return {
            imageUrl: generatedImageUrl,
            seed: generatedSeed
          };
        }

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