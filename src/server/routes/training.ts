import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { LoraStatus, TrainStatus } from '@prisma/client';
import { TrainingService } from '../../services/training.js';
import { StorageService } from '../../services/storage.js';
import { createTrainingArchive, type TrainingFile } from '../../lib/zip.js';
import type { MultipartFile } from '@fastify/multipart';

interface TrainingStartRequest {
  steps: number;
  is_style: boolean;
  create_masks: boolean;
  trigger_word: string;
  captions: Record<string, string>;
}

// Services
const trainingService = new TrainingService();
const storageService = new StorageService();

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
      }
    }
  }, async (request, reply) => {
    try {
      const telegramId = request.headers['x-telegram-user-id'] as string;
      
      // Parse multipart form data
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No files uploaded' });
      }

      // Extract files and parameters
      const files: TrainingFile[] = [];
      let params: TrainingStartRequest | null = null;

      // Handle multipart data
      for await (const part of data) {
        if (part.type === 'file') {
          const file = part as MultipartFile;
          const buffer = await file.toBuffer();
          files.push({
            buffer,
            filename: file.filename,
            contentType: file.mimetype
          });
        } else if (part.fieldname === 'params') {
          params = JSON.parse(await part.value);
        }
      }

      if (!params) {
        return reply.status(400).send({ error: 'Missing training parameters' });
      }

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

      // Create training zip
      const zipBuffer = await createTrainingArchive({
        files,
        captions: params.captions
      });

      // Upload to storage
      const zipUrl = await storageService.uploadFile(zipBuffer, {
        key: `training/${user.databaseId}/${Date.now()}.zip`,
        contentType: 'application/zip',
        expiresIn: 24 * 60 * 60, // 24 hours
        public: true
      });

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
            imageUrls: [zipUrl],
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
      
      const result = await trainingService.trainModel({
        images_data_url: zipUrl,
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
            weightsUrl: result.weights.url,
            configUrl: result.config.url,
            status: LoraStatus.COMPLETED
          }
        }),
        prisma.training.update({
          where: { loraId: lora.databaseId },
          data: { 
            status: TrainStatus.COMPLETED,
            completedAt: new Date(),
            metadata: JSON.stringify(result)
          }
        })
      ]);

      // Clean up zip file
      await storageService.deleteFile(`training/${user.databaseId}/${Date.now()}.zip`);

      logger.info({
        loraId: lora.databaseId,
        trainingId: training.databaseId,
        weightsUrl: result.weights.url
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