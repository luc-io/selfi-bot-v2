import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { generationService } from '../../services/generation';
import { prisma } from '../../lib/prisma';

const generateRequestSchema = z.object({
  prompt: z.string().min(1),
  negativePrompt: z.string().optional(),
  loraId: z.string().optional(),
  seed: z.number().optional()
});

const routes: FastifyPluginAsync = async (fastify) => {
  // Authentication middleware
  fastify.addHook('preHandler', async (request, reply) => {
    const userId = request.headers['x-user-id'];
    if (!userId) {
      return reply.status(401).send({
        error: {
          code: 'unauthorized',
          message: 'Authentication required'
        }
      });
    }

    // Get user
    const user = await prisma.user.findFirst({
      where: { telegramId: userId.toString() }
    });

    if (!user) {
      return reply.status(401).send({
        error: {
          code: 'unauthorized',
          message: 'User not found'
        }
      });
    }

    request.user = user;
  });

  // Generate image
  fastify.post('/generate', {
    schema: {
      body: generateRequestSchema
    },
    handler: async (request, reply) => {
      const user = request.user;
      const { prompt, negativePrompt, loraId, seed } = request.body;

      // Get base model
      const baseModel = await prisma.baseModel.findFirst({
        where: { isDefault: true }
      });

      if (!baseModel) {
        throw new Error('No default model configured');
      }

      // Calculate cost
      const cost = loraId ? 2 : 1;

      // Generate
      const generation = await generationService.generateImage({
        userId: user.id,
        baseModelId: baseModel.id,
        loraId,
        prompt,
        negativePrompt,
        seed,
        starsRequired: cost
      });

      return {
        id: generation.id,
        imageUrl: generation.imageUrl,
        prompt: generation.prompt,
        seed: generation.seed,
        starsUsed: generation.starsUsed
      };
    }
  });

  // Get user's generations
  fastify.get('/generations', {
    schema: {
      querystring: z.object({
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0)
      })
    },
    handler: async (request) => {
      const { limit, offset } = request.query;
      const user = request.user;

      const [generations, total] = await Promise.all([
        prisma.generation.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          include: {
            lora: {
              select: {
                name: true,
                triggerWord: true
              }
            }
          }
        }),
        prisma.generation.count({
          where: { userId: user.id }
        })
      ]);

      return {
        generations: generations.map(gen => ({
          id: gen.id,
          imageUrl: gen.imageUrl,
          prompt: gen.prompt,
          negativePrompt: gen.negativePrompt,
          seed: gen.seed,
          starsUsed: gen.starsUsed,
          createdAt: gen.createdAt,
          lora: gen.lora ? {
            name: gen.lora.name,
            triggerWord: gen.lora.triggerWord
          } : null
        })),
        pagination: {
          total,
          hasMore: offset + generations.length < total
        }
      };
    }
  });
};

export default routes;