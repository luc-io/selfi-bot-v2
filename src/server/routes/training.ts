import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { LoraStatus, TrainStatus, Prisma } from '@prisma/client';
import { TrainingService } from '../../services/training.js';
import { StorageService } from '../../services/storage.js';
import { createTrainingArchive, type TrainingFile } from '../../lib/zip.js';
import type { MultipartFile } from '@fastify/multipart';

// ... [rest of the file remains unchanged until the status endpoint]

  // Get training status by training ID with progress information
  app.get('/training/:id/status', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

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
        return reply.status(404).send({ error: 'Training not found' });
      }

      const metadata = training.metadata as Prisma.JsonObject | null;
      const isTestMode = metadata ? Boolean(metadata.test_mode) : false;

      // Get real-time progress from training service using actual falRequestId
      const progress = training.falRequestId ? 
        trainingService.getTrainingProgress(training.falRequestId) : 
        null;

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
        }
      }

      return reply.send({
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
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get training status');
      const errorMessage = error instanceof Error ? error.message : 'Failed to get training status';
      reply.status(500).send({ error: errorMessage });
    }
  });