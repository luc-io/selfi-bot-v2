import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';

export async function paramsRoutes(server: FastifyInstance) {
  server.post('/api/params', async (request, reply) => {
    const { model, params } = request.body as any;
    const userId = request.headers['x-user-id'] as string;

    if (!userId) {
      return reply.status(400).send({ error: 'User ID is required' });
    }

    try {
      // First ensure user exists
      const user = await prisma.user.findUnique({
        where: { telegramId: userId }
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // Update or create parameters
      const savedParams = await prisma.userParameters.upsert({
        where: {
          userId: user.id
        },
        update: {
          params: params
        },
        create: {
          userId: user.id,
          params: params
        }
      });

      logger.info({ userId, modelId: model.id }, 'Parameters saved');
      return reply.send(savedParams);
    } catch (error) {
      logger.error(error, 'Error saving parameters');
      return reply.status(500).send({ error: 'Failed to save parameters' });
    }
  });

  // Add endpoint to get user parameters
  server.get('/api/params/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };

    try {
      const user = await prisma.user.findUnique({
        where: { telegramId: userId },
        include: {
          parameters: true
        }
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send(user.parameters);
    } catch (error) {
      logger.error(error, 'Error fetching parameters');
      return reply.status(500).send({ error: 'Failed to fetch parameters' });
    }
  });
}
