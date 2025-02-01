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
      const { user_id, model, params } = request.body;
      
      logger.info({ user_id, model }, 'Saving user parameters');
      
      try {
        await handleSaveParams(user_id, model, params);
        
        logger.info({ user_id }, 'Parameters saved successfully');
        return reply.status(200).send({
          success: true,
          message: 'Parameters saved successfully'
        });
      } catch (error) {
        logger.error({ error, user_id }, 'Failed to save parameters');
        return reply.status(500).send({
          success: false,
          message: 'Failed to save parameters'
        });
      }
    }
  });

  // Get user parameters (optional)
  fastify.get<{ Querystring: { user_id: string } }>('/api/params', {
    preHandler: [validateInitData],
    handler: async (request, reply) => {
      const { user_id } = request.query;
      
      logger.info({ user_id }, 'Getting user parameters');
      
      try {
        // Get params logic here
        // Return user's saved parameters
        
        return reply.status(200).send({
          success: true,
          data: {
            // Return saved params
          }
        });
      } catch (error) {
        logger.error({ error, user_id }, 'Failed to get parameters');
        return reply.status(500).send({
          success: false,
          message: 'Failed to get parameters'
        });
      }
    }
  });
}