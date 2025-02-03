import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';

export const paramsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/parameters/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: userId },
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

  fastify.put('/parameters/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const parameters = request.body as Prisma.JsonValue;

    const user = await prisma.user.findUnique({
      where: { id: userId },
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
        userId
      },
      create: {
        userId,
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