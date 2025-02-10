import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';

// Note: We use a named default export for consistency with other routes
const imagesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/images', {
    schema: {
      headers: {
        type: 'object',
        required: ['x-telegram-user-id'],
        properties: {
          'x-telegram-user-id': { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 }
        }
      }
    },
    handler: async (request, reply) => {
      try {
        const telegramId = request.headers['x-telegram-user-id'] as string;
        const { page = 1, limit = 10 } = request.query as { page?: number; limit?: number };
        const skip = (page - 1) * limit;

        // Find user by telegram ID
        const user = await prisma.user.findUnique({
          where: { telegramId },
          select: { databaseId: true }
        });

        if (!user) {
          return reply.status(404).send({ error: 'User not found' });
        }

        const [generations, total] = await Promise.all([
          prisma.generation.findMany({
            where: {
              userDatabaseId: user.databaseId,
            },
            orderBy: {
              createdAt: 'desc'
            },
            take: limit,
            skip,
            include: {
              baseModel: true,
              lora: true
            }
          }),
          prisma.generation.count({
            where: {
              userDatabaseId: user.databaseId,
            }
          })
        ]);

        const images = generations.map(gen => ({
          id: gen.databaseId,
          url: gen.imageUrl,
          prompt: gen.prompt,
          seed: gen.seed ? Number(gen.seed) : undefined,
          createdAt: gen.createdAt.toISOString(),
          hasNsfw: false, // TODO: Add NSFW detection if implemented
          params: {
            ...(gen.metadata as Record<string, unknown> || {}),
            modelPath: gen.baseModel.modelPath,
          },
          loras: gen.lora ? [{
            path: gen.lora.databaseId,
            scale: (gen.metadata as Record<string, unknown> || {}).loraScale as number || 1
          }] : [],
        }));

        logger.info({
          userDatabaseId: user.databaseId,
          page,
          limit,
          count: images.length,
          total
        }, 'Fetched user generated images');

        return {
          images,
          total,
          hasMore: total > skip + generations.length
        };
      } catch (error) {
        logger.error({ error }, 'Failed to fetch user images');
        return reply.status(500).send({ error: 'Failed to fetch user images' });
      }
    }
  });

  logger.info('Images routes registered');
};

export default imagesRoutes;