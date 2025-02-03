import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';

export const paramsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/parameters/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userParameters: true  // Changed from parameters to userParameters to match schema
      }
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send({
      parameters: user.userParameters?.params || {}  // Default to empty object if no parameters
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