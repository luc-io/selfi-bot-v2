import { fal } from "@fal-ai/client";
import { logger } from '../lib/logger.js';
import { StarsService } from './stars.js';
import { prisma } from '../lib/prisma.js';
import { LoraStatus, TrainStatus } from '@prisma/client';
import EventEmitter from 'events';

// ... (other interfaces remain the same) ...

export interface TrainingProgress {
  status: 'pending' | 'training' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  message?: string;
  error?: string;
  startTime?: Date;
  estimatedTimeRemaining?: number;
}

export class TrainingService extends EventEmitter {
  // ... (other methods remain the same) ...

  public async cancelTraining(requestId: string): Promise<boolean> {
    try {
      const controller = this.falAbortControllers.get(requestId);
      if (!controller) {
        logger.warn({ requestId }, 'No abort controller found for training');
        return false;
      }

      // Abort the FAL request
      controller.abort();

      // Update training status
      const training = this.activeTrainings.get(requestId);
      if (training) {
        const updatedProgress: TrainingProgress = {
          ...training,
          status: 'cancelled',
          message: 'Training cancelled by user'
        };
        this.activeTrainings.set(requestId, updatedProgress);
        this.emit('trainingProgress', { requestId, progress: updatedProgress });
      }

      // Update database status with FAILED instead of CANCELLED
      await prisma.$transaction([
        prisma.loraModel.update({
          where: { databaseId: requestId },
          data: { status: LoraStatus.FAILED }
        }),
        prisma.training.update({
          where: { databaseId: requestId },
          data: { 
            status: TrainStatus.FAILED,
            completedAt: new Date(),
            error: 'Training cancelled by user'
          }
        })
      ]);

      logger.info({ requestId }, 'Training cancelled successfully');
      return true;
    } catch (error) {
      logger.error({ error, requestId }, 'Failed to cancel training');
      return false;
    }
  }

  // ... (rest of the code remains the same) ...
}