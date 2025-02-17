import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { LoraStatus, TrainStatus, Prisma } from '@prisma/client';
import { trainingService } from '../../services/training.js';
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
const MAX_FILE_SIZE = 25 * 1024 * 1024;  // 25MB per file for high-quality photos
const MAX_TOTAL_SIZE = 300 * 1024 * 1024; // 300MB total to match nginx config
const MAX_FILES = 20;  // Good number for training set

// Services
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
        logger.debug('Starting file processing');

        for await (const part of parts) {
          if (part.type === 'file') {
            const file = part;
            logger.debug({ filename: file.filename }, 'Processing file');

            // Check file count before processing
            if (files.length >= MAX_FILES) {
              logger.warn({ 
                currentCount: files.length, 
                maxFiles: MAX_FILES,
                filename: file.filename 
              }, 'Maximum file count exceeded');
              throw new Error(`Maximum number of files (${MAX_FILES}) exceeded`);
            }

            // Check file size
            const buffer = await file.toBuffer();
            const fileSize = buffer.length;

            logger.debug({ 
              filename: file.filename,
              size: fileSize,
              maxSize: MAX_FILE_SIZE,
              totalSize: totalSize + fileSize,
              maxTotalSize: MAX_TOTAL_SIZE
            }, 'File size check');

            if (fileSize > MAX_FILE_SIZE) {
              throw new Error(`File ${file.filename} exceeds maximum size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
            }

            // Check total size
            totalSize += fileSize;
            if (totalSize > MAX_TOTAL_SIZE) {
              throw new Error(`Total upload size exceeds ${MAX_TOTAL_SIZE / (1024 * 1024)}MB limit`);
            }

            files.push({
              buffer,
              filename: file.filename,
              contentType: file.mimetype
            });

            logger.debug({ 
              currentFiles: files.length,
              filename: file.filename,
              totalSize 
            }, 'File added to processing queue');

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

        logger.info({ 
          totalFiles: files.length,
          totalSize: totalSize / (1024 * 1024) + 'MB',
          hasParams: !!params 
        }, 'File processing completed');

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
              starsSpent: isTestMode ? 0 : 150,
              status: TrainStatus.PROCESSING,
              metadata,
              // Initialize falRequestId as null, will be updated after FAL request
              falRequestId: null
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
          telegramId,
          images_data_url: zipUrl,
          trigger_word: params.trigger_word,
          steps: params.steps,
          is_style: params.is_style,
          create_masks: params.create_masks
        }, isTestMode);

        // Store FAL request ID
        await prisma.training.update({
          where: { databaseId: training.databaseId },
          data: { 
            falRequestId: result.requestId
          }
        });

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
          falRequestId: result.requestId,
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

  // Get training status by training ID with progress information
  app.get('/training/:id/status', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      logger.info({ 
        id,
        endpoint: 'status'
      }, 'Training status request received');

      const training = await prisma.training.findFirst({
        where: { 
          OR: [
            { databaseId: id },
            { falRequestId: id }
          ]
        },
        include: {
          lora: true
        }
      });

      if (!training) {
        logger.warn({ id }, 'Training not found for status check');
        return reply.status(404).send({ error: 'Training not found' });
      }

      logger.info({ 
        trainingId: training.databaseId,
        falRequestId: training.falRequestId,
        status: training.status
      }, 'Training record found');

      const metadata = training.metadata as Prisma.JsonObject | null;
      const isTestMode = metadata ? Boolean(metadata.test_mode) : false;

      // Get real-time progress from training service using falRequestId
      const progress = training.falRequestId ? 
        trainingService.getTrainingProgress(training.falRequestId) : 
        null;

      logger.info({ 
        trainingId: training.databaseId,
        falRequestId: training.falRequestId,
        progress
      }, 'Retrieved training progress');

      let status = training.status;
      // If we have progress info and it indicates completion/failure, update status
      if (progress) {
        if (progress.status === 'completed' && status !== TrainStatus.COMPLETED) {
          status = TrainStatus.COMPLETED;
          // Update the database record
          await prisma.training.update({
            where: { databaseId: training.databaseId },
            data: { 
              status: TrainStatus.COMPLETED,
              completedAt: new Date()
            }
          });
          logger.info({ 
            trainingId: training.databaseId,
            newStatus: status 
          }, 'Updated training to completed status');

        } else if (progress.status === 'failed' && status !== TrainStatus.FAILED) {
          status = TrainStatus.FAILED;
          // Update the database record
          await prisma.training.update({
            where: { databaseId: training.databaseId },
            data: { 
              status: TrainStatus.FAILED,
              error: progress.message || 'Training failed'
            }
          });
          logger.warn({ 
            trainingId: training.databaseId,
            newStatus: status,
            error: progress.message
          }, 'Updated training to failed status');
        }
      }

      // Prepare response
      const response = {
        trainingId: training.databaseId,
        loraId: training.loraId,
        falRequestId: training.falRequestId,
        status: training.lora.status,
        trainingStatus: status,
        metadata: training.metadata,
        error: training.error,
        completedAt: training.completedAt,
        test_mode: isTestMode,
        progress: progress ? {
          status: progress.status,
          progress: progress.progress,
          message: progress.message
        } : null
      };

      logger.info({ 
        trainingId: training.databaseId,
        falRequestId: training.falRequestId,
        status,
        progress: response.progress
      }, 'Sending training status response');

      return reply.send(response);
    } catch (error) {
      logger.error({ error }, 'Failed to get training status');
      const errorMessage = error instanceof Error ? error.message : 'Failed to get training status';
      reply.status(500).send({ error: errorMessage });
    }
  });

  logger.info('Training routes registered');
}