import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { LoraStatus } from '@prisma/client';

interface TrainingStartRequest {
  name: string;
  instancePrompt: string;
  classPrompt?: string;
  steps?: number;
  learningRate?: number;
}

// Default values when not provided in the request
const DEFAULT_TRAINING_STEPS = 600;
const DEFAULT_LEARNING_RATE = 0.0001;

export async function trainingRoutes(app: FastifyInstance) {
  // Start training
  app.post('/training/start', {
    schema: {
      headers: {
        type: 'object',
        required: ['x-telegram-user-id'],
        properties: {
          'x-telegram-user-id': { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['name', 'instancePrompt'],
        properties: {
          name: { type: 'string' },
          instancePrompt: { type: 'string' },
          classPrompt: { type: 'string' },
          steps: { type: 'number' },
          learningRate: { type: 'number' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const telegramId = request.headers['x-telegram-user-id'] as string;
      const params = request.body as TrainingStartRequest;

      if (!telegramId) {
        return reply.status(400).send({ error: 'Missing user ID' });
      }

      // Get user
      const user = await prisma.user.findUnique({
        where: { telegramId }
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // Find base model
      const baseModel = await prisma.baseModel.findFirst({
        where: { modelPath: 'fal-ai/flux-lora' }
      });

      if (!baseModel) {
        return reply.status(500).send({ error: 'Base model not found' });
      }

      // Create LoRA model
      const lora = await prisma.loraModel.create({
        data: {
          name: params.name,
          triggerWord: params.name.toLowerCase().replace(/[^\w\s]/g, ''),
          baseModelId: baseModel.databaseId,
          userDatabaseId: user.databaseId,
          status: LoraStatus.PENDING
        },
        include: {
          training: true
        }
      });

      // Create training record
      const training = await prisma.training.create({
        data: {
          loraId: lora.databaseId,
          baseModelId: baseModel.databaseId,
          userDatabaseId: user.databaseId,
          instancePrompt: params.instancePrompt,
          classPrompt: params.classPrompt,
          steps: params.steps || DEFAULT_TRAINING_STEPS,
          learningRate: params.learningRate || DEFAULT_LEARNING_RATE,
          starsSpent: 100, // TODO: Make configurable
          imageUrls: [], // Will be populated during training
        }
      });

      logger.info({
        loraId: lora.databaseId,
        trainingId: training.databaseId,
        userId: user.databaseId
      }, 'Training started');

      return reply.send({
        id: lora.databaseId,
        trainingId: training.databaseId
      });
    } catch (error) {
      logger.error({ error }, 'Failed to start training');
      reply.status(500).send({ error: 'Failed to start training' });
    }
  });

  // Get training status
  app.get('/training/:id/status', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const training = await prisma.training.findFirst({
        where: { loraId: id },
        include: {
          lora: true
        }
      });

      if (!training) {
        return reply.status(404).send({ error: 'Training not found' });
      }

      return reply.send({
        status: training.lora.status,
        metadata: training.metadata,
        error: training.error,
        completedAt: training.completedAt
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get training status');
      reply.status(500).send({ error: 'Failed to get training status' });
    }
  });

  logger.info('Training routes registered');
}