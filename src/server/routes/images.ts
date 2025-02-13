import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';

// Note: The actual route will be /api/images because the parent plugin has the /api prefix
const imagesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.route({
    method: 'GET',
    url: '/',
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

        logger.info({
          telegramId,
          page,
          limit,
          url: request.url,
          method: request.method,
          prefix: fastify.prefix
        }, 'Images route handler called');

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

        const images = generations.map(gen => {
          const metadata = gen.metadata as Record<string, any> | null || {};
          
          // Get LoRAs from metadata where they are stored
          const loras = metadata.loras || [];

          return {
            id: gen.databaseId,
            url: gen.imageUrl,
            prompt: gen.prompt,
            seed: gen.seed ? Number(gen.seed) : undefined,
            createdAt: gen.createdAt.toISOString(),
            hasNsfw: false, // TODO: Add NSFW detection if implemented
            params: {
              ...metadata,
              modelPath: gen.baseModel.modelPath,
            },
            loras: loras.map((lora: any) => ({
              path: lora.id,
              name: lora.name,
              triggerWord: lora.triggerWord,
              scale: lora.scale
            }))
          };
        });

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