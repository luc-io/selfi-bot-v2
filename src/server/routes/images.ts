import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';

export const imagesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/images', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 }
        }
      }
    },
    handler: async (request) => {
      const { userId } = request;
      if (!userId) throw new Error('User not found');

      const { page = 1, limit = 10 } = request.query as { page?: number; limit?: number };
      const skip = (page - 1) * limit;

      const [generations, total] = await Promise.all([
        prisma.generation.findMany({
          where: {
            userDatabaseId: userId,
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
            userDatabaseId: userId,
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

      return {
        images,
        total,
        hasMore: total > skip + generations.length
      };
    }
  });
};