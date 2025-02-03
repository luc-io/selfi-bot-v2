import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';

export const paramsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/parameters/:telegramId', async (request, reply) => {
    const { telegramId } = request.params as { telegramId: string };

    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: {
        parameters: true
      }
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send({
      parameters: user.parameters?.params || {}
    });
  });

  fastify.put('/parameters/:telegramId', async (request, reply) => {
    const { telegramId } = request.params as { telegramId: string };
    const parameters = request.body as Record<string, unknown>;

    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: {
        parameters: true
      }
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // Cast parameters to Prisma.InputJsonValue to ensure type compatibility
    const jsonParams = parameters as Prisma.InputJsonValue;

    const updatedParams = await prisma.userParameters.upsert({
      where: {
        userDatabaseId: user.databaseId
      },
      create: {
        user: { connect: { telegramId } },
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