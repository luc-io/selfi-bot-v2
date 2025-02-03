import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';

export const paramsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/parameters/:telegramId', async (request, reply) => {
    const { telegramId } = request.params as { telegramId: string };

    const user = await prisma.user.findUnique({
      where: { telegramId },
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

  fastify.put('/parameters/:telegramId', async (request, reply) => {
    const { telegramId } = request.params as { telegramId: string };
    const parameters = request.body as Record<string, unknown>;

    const user = await prisma.user.findUnique({
      where: { telegramId },
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
        user: { telegramId }
      },
      create: {
        user: { connect: { telegramId } },
        params: parameters
      },
      update: {
        params: parameters
      }
    });

    return reply.send({
      parameters: updatedParams.params
    });
  });
};