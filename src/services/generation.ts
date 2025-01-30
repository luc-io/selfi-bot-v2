import { FAL } from '@fal-ai/client';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { logger } from '../lib/logger';

const fal = new FAL({
  credentials: {
    key: config.FAL_KEY,
  },
});

const prisma = new PrismaClient();

interface GenerationOptions {
  prompt: string;
  negativePrompt?: string;
  loraPath?: string;
  loraScale?: number;
  seed?: number;
}

export class GenerationService {
  static async generate(userId: string, options: GenerationOptions) {
    const { prompt, negativePrompt, loraPath, loraScale = 0.8, seed } = options;

    // Start generation
    let imageUrl: string | null = null;
    let error: string | null = null;

    try {
      const result = await fal.subscribe('fal-ai/flux-party', {
        input: {
          prompt,
          negative_prompt: negativePrompt,
          lora_path: loraPath,
          lora_scale: loraScale,
          seed,
        },
        pollInterval: 1000,
        logs: true,
        onQueueUpdate: (update: any) => {
          logger.info({ queue: update }, 'Generation queue update');
        },
      });

      imageUrl = result.image.url;

      // Save generation to database
      await prisma.generation.create({
        data: {
          userId,
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