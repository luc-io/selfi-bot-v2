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

const DEFAULT_BASE_MODEL_ID = 'flux-default';
const DEFAULT_IMAGE_SIZE = 'landscape_4_3';

export class GenerationService {
  static async generate(userId: string, options: GenerationOptions) {
    const { prompt, negativePrompt, loraPath, loraScale = 0.8, seed } = options;

    try {
      // First check user's stars balance
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user || user.stars < 1) {
        throw new Error('Insufficient stars balance');
      }

      // Generate image
      const falResult = await fal.subscribe('fal-ai/flux-lora', {
        input: {
          prompt,
          negative_prompt: negativePrompt,
          lora_path: loraPath,
          lora_scale: loraScale,
          seed,
          image_size: DEFAULT_IMAGE_SIZE,
          num_inference_steps: 28,
          guidance_scale: 3.5,
        } as FalRequest,
        pollInterval: 1000,
        logs: true,
        onQueueUpdate: (update: { status: string; position?: number }) => {
          logger.info({ 
            status: update.status,
            position: update.position,
            prompt,
            userId
          }, 'Generation queue update');
        },
      });

      logger.info({ 
        falResponse: falResult,
        prompt,
        userId 
      }, 'FAL API Response');

      const response = falResult as unknown as FalResponse;
      
      if (!response?.data?.images?.length) {
        throw new Error('No images generated in response');
      }

      const imageUrl = response.data.images[0].url;

      // Now that we have the image, update the database in a transaction
      const result = await prisma.$transaction([
        // Create generation record
        prisma.generation.create({
          data: {
            userId,
            baseModelId: DEFAULT_BASE_MODEL_ID,
            prompt,
            negativePrompt,
            imageUrl,
            seed: seed ? BigInt(seed) : null,
            starsUsed: 1,
          },
        }),
        // Decrement user's stars
        prisma.user.update({
          where: { id: userId },
          data: {
            stars: { decrement: 1 }
          }
        })
      ], {
        timeout: 10000 // 10 second timeout for the database operations
      });

      logger.info({ 
        imageUrl, 
        prompt, 
        timing: response.data.timings?.inference,
        newStarsBalance: result[1].stars
      }, 'Generation succeeded');

      return { imageUrl };
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