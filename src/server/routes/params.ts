import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';

export const paramsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/params/:userId - Get user parameters
  fastify.get('/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };

    const user = await prisma.user.findUnique({
      where: { telegramId: userId },  // Use telegramId for consistency
      include: {
        userParameters: true
      }
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send({
      parameters: user.userParameters?.params || {}
    });
  });

  // POST /api/params - Create/Update parameters with userId in body
  fastify.post('/', async (request, reply) => {
    const { userId, ...parameters } = request.body as { userId: string } & Record<string, unknown>;

    const user = await prisma.user.findUnique({
      where: { telegramId: userId },  // Use telegramId for consistency
      include: {
        userParameters: true
      }
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // Update or create parameters
    const updatedParams = await prisma.userParameters.upsert({
      where: {
        userId: user.id  // Use internal ID for the relation
      },
      create: {
        userId: user.id,
        params: parameters as Prisma.InputJsonValue
      },
      update: {
        params: parameters as Prisma.InputJsonValue
      }
    });

    return reply.send({
      parameters: updatedParams.params
    });
  });

  // PUT /api/params/:userId - Update parameters
  fastify.put('/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const parameters = request.body as Record<string, unknown>;

    const user = await prisma.user.findUnique({
      where: { telegramId: userId },  // Use telegramId for consistency
      include: {
        userParameters: true
      }
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // Update or create parameters
    const updatedParams = await prisma.userParameters.upsert({
      where: {
        userId: user.id  // Use internal ID for the relation
      },
      create: {
        userId: user.id,
        params: parameters as Prisma.InputJsonValue
      },
      update: {
        params: parameters as Prisma.InputJsonValue
      }
    });

    return reply.send({
      parameters: updatedParams.params
    });
  });
};