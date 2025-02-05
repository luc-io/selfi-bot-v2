import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';

export async function setupApiRoutes(server: FastifyInstance) {
  // Get user parameters
  server.get('/api/params/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    
    try {
      const userParams = await prisma.userParams.findUnique({
        where: { userId }
      });
      
      return reply.send(userParams || {});
    } catch (error) {
      logger.error({ error, userId }, 'Error getting user parameters');
      return reply.status(500).send({ error: 'Failed to get user parameters' });
    }
  });

  // Save user parameters
  server.post('/api/params', async (request, reply) => {
    const { userId, params } = request.body as { userId: string; params: any };
    
    try {
      const userParams = await prisma.userParams.upsert({
        where: { userId },
        update: { params },
        create: { userId, params }
      });
      
      return reply.send(userParams);
    } catch (error) {
      logger.error({ error, userId, params }, 'Error saving user parameters');
      return reply.status(500).send({ error: 'Failed to save user parameters' });
    }
  });

  // Get available LoRA models
  server.get('/api/loras/available', async (request, reply) => {
    try {
      const loras = await prisma.loraModel.findMany({
        where: { isPublic: true }
      });
      
      return reply.send(loras);
    } catch (error) {
      logger.error({ error }, 'Error getting available LoRA models');
      return reply.status(500).send({ error: 'Failed to get LoRA models' });
    }
  });

  // Get user's LoRA models
  server.get('/api/loras/user', async (request, reply) => {
    const { userId } = request.query as { userId: string };
    
    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' });
    }

    try {
      const loras = await prisma.loraModel.findMany({
        where: {
          OR: [
            { isPublic: true },
            { userId }
          ]
        }
      });
      
      return reply.send(loras);
    } catch (error) {
      logger.error({ error, userId }, 'Error getting user LoRA models');
      return reply.status(500).send({ error: 'Failed to get LoRA models' });
    }
  });
}