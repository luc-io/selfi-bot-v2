import { fal } from '@fal-ai/client';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { logger } from '../lib/logger';

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
}

const DEFAULT_BASE_MODEL_ID = 'flux-default';

export class GenerationService {
  static async generate(userId: string, options: GenerationOptions) {
    const { prompt, negativePrompt, loraPath, loraScale = 0.8, seed } = options;

    // Start generation
    let imageUrl = '';
    let error: string | null = null;

    try {
      const result = await fal.subscribe('fal-ai/flux-party', {
        input: {
          prompt,
          negative_prompt: negativePrompt,
          lora_path: loraPath,
          lora_scale: loraScale,
          seed,
        } as FalRequest,
        pollInterval: 1000,
        logs: true,
        onQueueUpdate: (update: { status: string; position?: number }) => {
          logger.info({ queue: update }, 'Generation queue update');
        },
      });

      const response = result as { image: { url: string } };
      if (!response?.image?.url) {
        throw new Error('No image URL in response');
      }

      imageUrl = response.image.url;

      // Save generation to database
      await prisma.generation.create({
        data: {
          userId,
          baseModelId: DEFAULT_BASE_MODEL_ID,
          prompt,
          negativePrompt,
          imageUrl,
          seed: seed ? BigInt(seed) : null,
          starsUsed: 1,
        },
      });

      return { imageUrl };
    } catch (e: any) {
      error = e.message;
      logger.error({ error: e }, 'Generation failed');
      throw new Error('Generation failed: ' + error);
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