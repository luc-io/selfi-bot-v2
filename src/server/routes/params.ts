import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { validateTelegramWebAppData } from '../../lib/telegram.js';

interface ParameterRequestBody {
  model?: {
    modelPath: string;
  };
  params: {
    image_size?: string;
    num_inference_steps?: number;
    seed?: number;
    guidance_scale?: number;
    num_images?: number;
    sync_mode?: boolean;
    enable_safety_checker?: boolean;
    output_format?: string;
    loras?: Array<{
      path: string;
      scale: number;
    }>;
  };
}

export const paramsRoutes: FastifyPluginAsync = async (fastify) => {
  // Get user parameters
  fastify.get('/params/:userId', async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };
      logger.info({ userId }, 'Getting user parameters');

      const user = await prisma.user.findUnique({
        where: { telegramId: userId },
        include: {
          parameters: true
        }
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send({
        params: user.parameters?.params || {}
      });
    } catch (error) {
      logger.error({ error }, 'Error getting user parameters');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Save user parameters
  fastify.post('/params', async (request, reply) => {
    try {
      const { model, params } = request.body as ParameterRequestBody;
      const telegramId = request.headers['x-telegram-user-id'] as string;

      if (!telegramId) {
        logger.warn({ headers: request.headers }, 'Missing user ID');
        return reply.status(400).send({ error: 'Missing user ID' });
      }

      logger.info({ telegramId, params }, 'Saving user parameters');

      // Get or create user
      const user = await prisma.user.upsert({
        where: { telegramId },
        create: { telegramId },
        update: {}
      });

      // Save parameters merging model and params into a single structure
      const savedParams = await prisma.userParameters.upsert({
        where: {
          userDatabaseId: user.databaseId
        },
        create: {
          user: { connect: { databaseId: user.databaseId } },
          params: {
            ...params,
            modelPath: model?.modelPath || 'fal-ai/flux-lora'
          }
        },
        update: {
          params: {
            ...params,
            modelPath: model?.modelPath || 'fal-ai/flux-lora'
          }
        }
      });

      logger.info({ 
        telegramId,
        params: savedParams.params
      }, 'Parameters saved successfully');

      return reply.send({
        params: savedParams.params
      });
    } catch (error) {
      logger.error({ error }, 'Error saving user parameters');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // This route is called by the bot to validate parameters
  fastify.post('/params/validate', async (request, reply) => {
    try {
      const { model, params } = request.body as ParameterRequestBody;

      // Here we could add validation logic
      // For now, we just return success
      return reply.send({
        valid: true,
        params: {
          ...params,
          modelPath: model?.modelPath || 'fal-ai/flux-lora'
        }
      });
    } catch (error) {
      logger.error({ error }, 'Error validating parameters');
      return reply.status(500).send({ error: 'Parameter validation failed' });
    }
  });
};