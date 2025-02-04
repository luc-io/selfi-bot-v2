import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';

export async function loraRoutes(app: FastifyInstance) {
  // Add CORS configuration for the route
  const corsConfig = {
    origin: '*',
    methods: ['GET']
  };

  app.get('/loras/available', {
    config: {
      cors: corsConfig
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
      
      // Add CORS headers
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET');
      
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
}