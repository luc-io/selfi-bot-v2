import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';

export const paramsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/parameters/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userParameters: true  // Changed from parameters to userParameters
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
    const parameters = request.body as Record<string, unknown>;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userParameters: true
      }
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // Cast parameters to Prisma.JsonValue to ensure type compatibility
    const jsonParams = parameters as Prisma.JsonValue;

    // Update or create parameters
    const updatedParams = await prisma.userParameters.upsert({
      where: {
        userId: userId
      },
      create: {
        userId: userId,
        params: jsonParams
      },
      update: {
        params: jsonParams
      }
    });

    return reply.send({
      parameters: updatedParams.params
    });
  });
};