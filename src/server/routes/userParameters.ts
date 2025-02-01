import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../lib/logger.js';

const prisma = new PrismaClient();

export default async function userParametersRoutes(fastify: FastifyInstance) {
  fastify.get('/api/user-parameters/:telegramId', async (request, reply) => {
    const { telegramId } = request.params as { telegramId: string };
    try {
      const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(telegramId) },
      });

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const parameters = await prisma.userParameters.findUnique({
        where: { userId: user.id },
      });

      return parameters;
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to get user parameters');
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post('/api/user-parameters/:telegramId', async (request, reply) => {
    const { telegramId } = request.params as { telegramId: string };
    const body = request.body as any;

    try {
      const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(telegramId) },
      });

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const parameters = await prisma.userParameters.upsert({
        where: { userId: user.id.toString() },
        update: {
          params: body.params || {},
          updatedAt: new Date(),
        },
        create: {
          userId: user.id.toString(),
          params: body.params || {},
        },
      });

      return parameters;
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to update user parameters');
      reply.code(500).send({ error: error.message || 'Internal server error' });
    }
  });
}