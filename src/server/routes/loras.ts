import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';

export async function loraRoutes(app: FastifyInstance) {
  app.get('/loras/available', async (request, reply) => {
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
      
      logger.info({ count: loras.length }, 'Fetched available LoRAs');
      return loras;
    } catch (error) {
      logger.error({ error }, 'Failed to fetch available LoRAs');
      reply.status(500).send({ error: 'Failed to fetch available LoRAs' });
    }
  });
}