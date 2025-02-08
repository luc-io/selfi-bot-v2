import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';

export async function userRoutes(app: FastifyInstance) {
  // Get user info
  app.get('/api/user/info', {
    schema: {
      headers: {
        type: 'object',
        required: ['x-telegram-user-id'],
        properties: {
          'x-telegram-user-id': { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const telegramId = request.headers['x-telegram-user-id'] as string;

      if (!telegramId) {
        return reply.status(400).send({ error: 'Missing user ID' });
      }

      const user = await prisma.user.findUnique({
        where: { telegramId },
        select: {
          stars: true,
          totalSpentStars: true,
          totalBoughtStars: true
        }
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      logger.info({ telegramId, stars: user.stars }, 'Retrieved user info');

      return reply.send({
        stars: user.stars,
        totalSpentStars: user.totalSpentStars,
        totalBoughtStars: user.totalBoughtStars
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get user info');
      const errorMessage = error instanceof Error ? error.message : 'Failed to get user info';
      reply.status(500).send({ error: errorMessage });
    }
  });

  logger.info('User routes registered');
}