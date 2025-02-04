import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';

export async function loraRoutes(app: FastifyInstance) {
  // Register GET /loras/available route
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
      logger.info('Receiving request for available LoRAs');
      
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
      
      logger.info({ 
        count: loras.length,
        loras: loras.map(l => ({id: l.databaseId, name: l.name}))
      }, 'Fetched available LoRAs');
      
      return loras;
    } catch (error) {
      logger.error({ error }, 'Failed to fetch available LoRAs');
      reply.status(500).send({ error: 'Failed to fetch available LoRAs' });
    }
  });

  // Log route registration
  logger.info('LoRA routes registered');
}