import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { LoraStatus, TrainStatus, Prisma } from '@prisma/client';
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

// Max file size and count limits
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB total
const MAX_FILES = 20;

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
          'x-telegram-user-id': { type: 'string' },
          'x-test-mode': { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const telegramId = request.headers['x-telegram-user-id'] as string;
      const isTestMode = request.headers['x-test-mode'] === 'true';
      
      if (isTestMode) {
        logger.info('Test mode enabled for training');
      }

      // Get all parts of the multipart request
      const parts = await request.parts();
      
      // Extract files and parameters with limits
      const files: TrainingFile[] = [];
      let params: TrainingStartRequest | null = null;
      let totalSize = 0;

      // Handle multipart data
      try {
        for await (const part of parts) {
          if (part.type === 'file') {
            const file = part;

            // Check file size
            const buffer = await file.toBuffer();
            const fileSize = buffer.length;

            if (fileSize > MAX_FILE_SIZE) {
              throw new Error(`File ${file.filename} exceeds maximum size of 10MB`);
            }

            // Check total size
            totalSize += fileSize;
            if (totalSize > MAX_TOTAL_SIZE) {
              throw new Error('Total upload size exceeds 50MB limit');
            }

            // Check file count
            if (files.length >= MAX_FILES) {
              throw new Error('Maximum number of files (20) exceeded');
            }

            files.push({
              buffer,
              filename: file.filename,
              contentType: file.mimetype
            });
          } else {
            // For non-file parts
            if (part.fieldname === 'params') {
              try {
                const value = await part.value;
                if (typeof value !== 'string') {
                  throw new Error('Invalid params format: expected string');
                }
                logger.info({ value }, 'Received params');
                params = JSON.parse(value);
              } catch (error) {
                logger.error({ error }, 'Failed to parse params');
                throw new Error('Invalid params format');
              }
            }
          }
        }
      } catch (error) {
        logger.error({ error }, 'File processing error');
        const errorMessage = error instanceof Error ? error.message : 'File processing error';
        return reply.status(400).send({ error: errorMessage });
      }

      if (!params) {
        return reply.status(400).send({ error: 'Missing training parameters' });
      }

      if (files.length === 0) {
        return reply.status(400).send({ error: 'No files uploaded' });
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

      try {
        // Create zipBuffer first
        const zipBuffer = await createTrainingArchive({
          files,
          captions: params.captions
        });

        // Clear file buffers to help GC
        files.forEach(f => f.buffer = Buffer.alloc(0));
        if (global.gc) global.gc();

        // Create LoRA model and training records first to get the databaseId
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

          const metadata: Prisma.JsonObject = isTestMode ? { test_mode: true } : {};

          const training = await tx.training.create({
            data: {
              lora: { connect: { databaseId: lora.databaseId } },
              user: { connect: { telegramId } },
              baseModel: { connect: { modelPath: 'fal-ai/flux-lora-fast-training' } },
              instancePrompt: params.trigger_word,
              steps: params.steps,
              starsSpent: isTestMode ? 0 : 10,
              status: TrainStatus.PROCESSING,
              metadata
            }
          });

          return [lora, training];
        });

        // Now use the training.databaseId for the file path
        const zipUrl = await storageService.uploadFile(zipBuffer, {
          key: `training/${training.databaseId}.zip`,
          contentType: 'application/zip',
          expiresIn: 24 * 60 * 60, // 24 hours
          public: true
        });

        // Update training with the zip URL
        await prisma.training.update({
          where: { databaseId: training.databaseId },
          data: { imageUrls: [zipUrl] }
        });

        // Clear zip buffer
        zipBuffer.fill(0);
        if (global.gc) global.gc();

        // Start FAL training (or mock in test mode)
        logger.info({ 
          trainingId: training.databaseId,
          loraId: lora.databaseId, 
          isTestMode 
        }, 'Starting FAL training');
        
        const result = await trainingService.trainModel({
          images_data_url: zipUrl,
          trigger_word: params.trigger_word,
          steps: params.steps,
          is_style: params.is_style,
          create_masks: params.create_masks
        }, isTestMode);

        // Convert result to a Prisma-compatible JSON object
        const trainingResult: Prisma.JsonObject = {
          weights: result.weights,
          config: result.config
        };

        if (isTestMode) {
          trainingResult.test_mode = true;
        }

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
            where: { databaseId: training.databaseId },
            data: { 
              status: TrainStatus.COMPLETED,
              completedAt: new Date(),
              metadata: trainingResult
            }
          })
        ]);

        // Clean up zip file
        await storageService.deleteFile(`training/${training.databaseId}.zip`);

        logger.info({
          trainingId: training.databaseId,
          loraId: lora.databaseId,
          weightsUrl: result.weights.url,
          isTestMode
        }, 'Training completed successfully');

        return reply.send({
          trainingId: training.databaseId,
          loraId: lora.databaseId,
          test_mode: isTestMode
        });

      } catch (error) {
        // Clean up any uploaded file on error - note we now need to get the ID from the error context
        if (error instanceof Error && 'trainingId' in error) {
          try {
            await storageService.deleteFile(`training/${(error as any).trainingId}.zip`);
          } catch (cleanupError) {
            logger.error({ cleanupError }, 'Failed to clean up training file');
          }
        }
        throw error;
      }

    } catch (error) {
      logger.error({ error }, 'Failed to start training');
      const errorMessage = error instanceof Error ? error.message : 'Failed to start training';
      reply.status(500).send({ error: errorMessage });
    }
  });

  // Get training status by training ID
  app.get('/training/:id/status', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const training = await prisma.training.findUnique({
        where: { databaseId: id },
        include: {
          lora: true
        }
      });

      if (!training) {
        return reply.status(404).send({ error: 'Training not found' });
      }

      const metadata = training.metadata as Prisma.JsonObject | null;
      const isTestMode = metadata ? Boolean(metadata.test_mode) : false;

      return reply.send({
        trainingId: training.databaseId,
        loraId: training.loraId,
        status: training.lora.status,
        metadata: training.metadata,
        error: training.error,
        completedAt: training.completedAt,
        test_mode: isTestMode
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get training status');
      const errorMessage = error instanceof Error ? error.message : 'Failed to get training status';
      reply.status(500).send({ error: errorMessage });
    }
  });

  logger.info('Training routes registered');
}
