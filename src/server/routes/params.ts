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

      // Validate the request is from Telegram
      const initData = request.headers['x-telegram-init-data'] as string;
      if (!initData || !validateTelegramWebAppData(initData)) {
        return reply.status(401).send({ error: 'Invalid authentication' });
      }

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

      // Validate the request is from Telegram
      const initData = request.headers['x-telegram-init-data'] as string;
      if (!initData || !validateTelegramWebAppData(initData)) {
        return reply.status(401).send({ error: 'Invalid authentication' });
      }

      // Extract user ID from headers
      const telegramId = request.headers['x-telegram-user-id'] as string;
      if (!telegramId) {
        return reply.status(400).send({ error: 'Missing user ID' });
      }

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
};