import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { LoraStatus, TrainStatus } from '@prisma/client';
import { FalService } from '../../services/fal.js';

interface TrainingStartRequest {
  steps: number;
  is_style: boolean;
  create_masks: boolean;
  trigger_word: string;
  images_data_url: string;
}

const falService = new FalService(
  process.env.FAL_KEY ?? '',
  process.env.FAL_SECRET ?? ''
);

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
        required: ['steps', 'trigger_word', 'images_data_url'],
        properties: {
          steps: { type: 'number' },
          is_style: { type: 'boolean' },
          create_masks: { type: 'boolean' },
          trigger_word: { type: 'string' },
          images_data_url: { type: 'string' }
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

      // Create LoRA model and training records
      const [lora, training] = await prisma.$transaction(async (tx) => {
        const lora = await tx.loraModel.create({
          data: {
            name: params.trigger_word,
            triggerWord: params.trigger_word,
            status: LoraStatus.TRAINING,
            baseModel: { connect: { modelPath: 'fal-ai/flux-lora-fast-training' } },
            user: { connect: { telegramId } }
          }
        });

        const training = await tx.training.create({
          data: {
            lora: { connect: { databaseId: lora.databaseId } },
            user: { connect: { telegramId } },
            baseModel: { connect: { modelPath: 'fal-ai/flux-lora-fast-training' } },
            imageUrls: [params.images_data_url],
            instancePrompt: params.trigger_word,
            steps: params.steps,
            starsSpent: 10,
            status: TrainStatus.PROCESSING
          }
        });

        return [lora, training];
      });

      // Start FAL training
      logger.info({ loraId: lora.databaseId }, 'Starting FAL training');
      
      const result = await falService.trainModel({
        images_data_url: params.images_data_url,
        trigger_word: params.trigger_word,
        steps: params.steps,
        is_style: params.is_style,
        create_masks: params.create_masks
      });

      // Update records with results
      await prisma.$transaction([
        prisma.loraModel.update({
          where: { databaseId: lora.databaseId },
          data: {
            weightsUrl: result.diffusers_lora_file.url,
            configUrl: result.config_file.url,
            status: LoraStatus.COMPLETED
          }
        }),
        prisma.training.update({
          where: { loraId: lora.databaseId },
          data: { 
            status: TrainStatus.COMPLETED,
            completedAt: new Date(),
            metadata: result
          }
        })
      ]);

      logger.info({
        loraId: lora.databaseId,
        trainingId: training.databaseId,
        weightsUrl: result.diffusers_lora_file.url
      }, 'Training completed successfully');

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