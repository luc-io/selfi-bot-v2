import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { validateTelegramWebAppData } from '../../lib/telegram.js';

export async function loraRoutes(app: FastifyInstance) {
  // Get available (public) LoRAs
  app.get('/loras/available', {
    schema: {
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              databaseId: { type: 'string' },
              name: { type: 'string' },
              triggerWord: { type: 'string' },
              status: { type: 'string' },
              isPublic: { type: 'boolean' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const loras = await prisma.loraModel.findMany({
        where: {
          status: 'COMPLETED',
          isPublic: true
        },
        select: {
          databaseId: true,
          name: true,
          triggerWord: true,
          status: true,
          isPublic: true
        },
        orderBy: {
          name: 'asc'
        }
      });
      
      return loras;
    } catch (error) {
      logger.error({ error }, 'Failed to fetch available LoRAs');
      reply.status(500).send({ error: 'Failed to fetch available LoRAs' });
    }
  });

  // Get user's LoRAs
  app.get('/loras/user', {
    schema: {
      headers: {
        type: 'object',
        required: ['x-telegram-user-id', 'x-telegram-init-data'],
        properties: {
          'x-telegram-user-id': { type: 'string' },
          'x-telegram-init-data': { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const initData = request.headers['x-telegram-init-data'] as string;
      const telegramId = request.headers['x-telegram-user-id'] as string;

      if (!initData || !validateTelegramWebAppData(initData)) {
        return reply.status(401).send({ error: 'Invalid authentication' });
      }

      const user = await prisma.user.findUnique({
        where: { telegramId },
        select: { databaseId: true }
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const loras = await prisma.loraModel.findMany({
        where: {
          OR: [
            { isPublic: true },
            { userDatabaseId: user.databaseId }
          ]
        },
        include: {
          training: {
            select: {
              steps: true,
              metadata: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return loras;
    } catch (error) {
      logger.error({ error }, 'Failed to fetch user LoRAs');
      reply.status(500).send({ error: 'Failed to fetch user LoRAs' });
    }
  });

  logger.info('LoRA routes registered');
}