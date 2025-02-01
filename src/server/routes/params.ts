import { FastifyInstance } from 'fastify';
import { validateInitData } from '../middleware/auth.js';
import type { ParamsData } from '../../types/api.js';
import { logger } from '../../lib/logger.js';
import { handleSaveParams } from '../handlers/params.js';

export async function paramsRoutes(fastify: FastifyInstance) {
  // Save user parameters
  fastify.post<{ Body: ParamsData }>('/api/params', {
    preHandler: [validateInitData],
    handler: async (request, reply) => {
      logger.info({ 
        headers: request.headers,
        body: request.body,
        url: request.url
      }, 'Received params request');

      const { user_id, model, params } = request.body;
      
      try {
        await handleSaveParams(user_id, model, params);
        
        logger.info({ user_id }, 'Parameters saved successfully');
        return reply.status(200).send({
          success: true,
          message: 'Parameters saved successfully'
        });
      } catch (error) {
        logger.error({ 
          error, 
          user_id,
          model,
          params 
        }, 'Failed to save parameters');

        return reply.status(500).send({
          success: false,
          message: error instanceof Error ? error.message : 'Failed to save parameters'
        });
      }
    }
  });
}