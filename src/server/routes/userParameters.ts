import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../lib/logger.js';

const prisma = new PrismaClient();

export default async function userParametersRoutes(fastify: FastifyInstance) {
  fastify.get('/api/user-parameters/:telegramId', async (request, reply) => {
    const { telegramId } = request.params as { telegramId: string };

    try {
      const user = await prisma.user.findUnique({
        where: { 
          telegramId: BigInt(telegramId) 
        },
        include: {
          parameters: true
        }
      });

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      return user.parameters;
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to get user parameters');
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post('/api/user-parameters/:telegramId', async (request, reply) => {
    const { telegramId } = request.params as { telegramId: string };
    const body = request.body as any;

    try {
      // First get user by telegramId
      const user = await prisma.user.findUnique({
        where: { 
          telegramId: BigInt(telegramId) 
        }
      });

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Then use the user.id to create/update parameters
      const parameters = await prisma.userParameters.upsert({
        where: { 
          userId: user.id  // This is the string ID
        },
        update: {
          params: body.params || {},
        },
        create: {
          userId: user.id,  // This is the string ID
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