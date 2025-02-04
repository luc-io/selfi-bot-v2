import { FastifyInstance } from 'fastify';
import { logger } from '../../lib/logger.js';

export async function testRoutes(app: FastifyInstance) {
  app.get('/test', async (request, reply) => {
    logger.info('Test endpoint accessed');
    
    // Add CORS headers
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET');
    
    return { status: 'ok', message: 'API is accessible' };
  });
}