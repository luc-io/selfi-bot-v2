import { fal } from "@fal-ai/client";
import { logger } from '../lib/logger.js';
import { StarsService } from './stars.js';
import { prisma } from '../lib/prisma.js';
import { TrainStatus } from '@prisma/client';

interface FalFile {
  url: string;
  content_type: string;
  file_name: string;
  file_size: number;
}

interface FalTrainingInput {
  images_data_url: string;
  trigger_word?: string;
  create_masks?: boolean;
  steps: number;
  is_style?: boolean;
  is_input_format_already_preprocessed?: boolean;
  data_archive_format?: string;
}

interface FalTrainingResponse {
  diffusers_lora_file: FalFile;
  config_file: FalFile;
  debug_preprocessed_output?: FalFile;
}

interface FalQueueStatusResponse {
  status: string;
  logs?: Array<{ message: string }>;
  requestId: string;
}

interface FalQueueResultResponse {
  data: FalTrainingResponse;
  requestId: string;
}

export interface TrainModelParams {
  telegramId: string;
  images_data_url: string;
  trigger_word: string;
  steps: number;
  is_style: boolean;
  create_masks: boolean;
}

export interface TrainingProgress {
  status: 'pending' | 'training' | 'completed' | 'failed';
  progress: number;
  message?: string;
}

export interface TrainingResult {
  requestId: string;
  weights: {
    url: string;
    fileName: string;
    fileSize: number;
    contentType: string;
  };
  config: {
    url: string;
    fileName: string;
    fileSize: number;
    contentType: string;
  };
}

const STANDARD_MESSAGES = {
  PENDING: 'Initializing training...',
  PROCESSING: 'Training in progress...',
  COMPLETED: 'Training completed successfully',
  FAILED: (error: string) => `Training failed: ${error}`
};

if (!process.env.FAL_KEY) {
  throw new Error('FAL_KEY environment variable is not set');
}

const credentials = process.env.FAL_KEY;

class TrainingService {
  private readonly activeTrainings = new Map<string, TrainingProgress>();
  private readonly TRAINING_COST = 150; // Training cost in stars

  constructor() {
    fal.config({
      credentials
    });
  }

  private convertFileToJson(file: FalFile) {
    return {
      url: file.url,
      fileName: file.file_name,
      fileSize: file.file_size,
      contentType: file.content_type
    };
  }

  private generateTestId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}_${random}`;
  }

  private getMockResult(trigger_word: string): TrainingResult {
    const testId = this.generateTestId();
    const baseUrl = `https://test-url/TEST_${testId}`;

    return {
      requestId: `test_${testId}`,
      weights: {
        url: `${baseUrl}_${trigger_word}_weights.safetensors`,
        fileName: `${trigger_word}_weights.safetensors`,
        fileSize: 1000000,
        contentType: "application/octet-stream"
      },
      config: {
        url: `${baseUrl}_${trigger_word}_config.json`,
        fileName: `${trigger_word}_config.json`,
        fileSize: 1000,
        contentType: "application/json"
      }
    };
  }

  public getTrainingProgress(requestId: string): TrainingProgress | null {
    const progress = this.activeTrainings.get(requestId);
    logger.info({
      requestId,
      hasProgress: !!progress,
      currentState: progress,
      allRequestIds: Array.from(this.activeTrainings.keys())
    }, 'Training progress check');
    return progress || null;
  }

  private async updateTrainingProgress(requestId: string, update: FalQueueStatusResponse) {
    if (!update.logs || update.logs.length === 0) {
      logger.debug({ requestId }, 'No logs in update');
      return;
    }

    try {
      // Log raw update for analysis
      logger.info({
        requestId,
        updateStatus: update.status,
        logsCount: update.logs.length,
        logs: update.logs.map(l => l.message)
      }, 'Processing progress update');

      // Update progress based on logs
      let progress = 0;
      let message = STANDARD_MESSAGES.PROCESSING;
      let currentStatus: TrainingProgress['status'] = 'training';

      // Find progress message
      const progressLog = update.logs
        .map((log) => log.message)
        .find((msg) => msg?.includes('%'));

      if (progressLog) {
        logger.info({
          requestId,
          progressLog
        }, 'Found progress message');

        const match = progressLog.match(/(\\d+)%/);
        if (match) {
          progress = parseInt(match[1]);
          logger.info({
            requestId,
            parsedProgress: progress
          }, 'Parsed progress value');
        }
      }

      // Get last valid message
      const lastValidMessage = update.logs
        .filter(log => log && log.message)
        .slice(-1)[0];

      if (lastValidMessage) {
        message = lastValidMessage.message;
      }

      // Update status based on FAL response
      if (update.status === 'COMPLETED') {
        currentStatus = 'completed';
        progress = 100;
        message = STANDARD_MESSAGES.COMPLETED;
      } else if (update.status === 'FAILED') {
        currentStatus = 'failed';
        // Use last log message as error if available
        const errorMessage = lastValidMessage?.message || 'Unknown error';
        message = STANDARD_MESSAGES.FAILED(errorMessage);
      }

      // Update training status in memory
      const updatedProgress = {
        status: currentStatus,
        progress,
        message
      };

      this.activeTrainings.set(requestId, updatedProgress);

      logger.info({
        requestId,
        previousProgress: this.activeTrainings.get(requestId),
        newProgress: updatedProgress
      }, 'Updated training progress');

      // Try to update training record in database
      const training = await prisma.training.findFirst({
        where: { falRequestId: requestId }
      });

      if (training) {
        if (currentStatus === 'completed' || currentStatus === 'failed') {
          // Update training record
          await prisma.training.update({
            where: { databaseId: training.databaseId },
            data: {
              status: currentStatus === 'completed' ? TrainStatus.COMPLETED : TrainStatus.FAILED,
              completedAt: currentStatus === 'completed' ? new Date() : null,
              error: currentStatus === 'failed' ? message : null
            }
          });

          logger.info({
            requestId,
            trainingId: training.databaseId,
            status: currentStatus
          }, 'Updated training record status');

          // Remove from active trainings after a delay
          setTimeout(() => {
            this.activeTrainings.delete(requestId);
            logger.info({
              requestId,
              remainingTrainings: Array.from(this.activeTrainings.keys())
            }, 'Removed completed training from active map');
          }, 60 * 1000); // Remove after 1 minute
        }
      } else {
        logger.warn({ 
          requestId,
          status: currentStatus
        }, 'Could not find training record to update status');
      }

    } catch (error) {
      logger.error({ 
        error, 
        requestId,
        updateData: update 
      }, 'Error processing training update');

      // Even if there's an error updating the database, maintain the in-memory status
      this.activeTrainings.set(requestId, {
        status: 'failed',
        progress: 0,
        message: STANDARD_MESSAGES.FAILED(error instanceof Error ? error.message : 'Internal error')
      });
    }
  }

  public async trainModel(params: TrainModelParams, isTest: boolean = false): Promise<TrainingResult> {
    try {
      logger.info({ params, isTest }, 'Starting model training');

      // Check if user has enough stars for training
      if (!isTest) {
        const hasEnoughStars = await StarsService.checkBalance(params.telegramId, this.TRAINING_COST);
        if (!hasEnoughStars) {
          throw new Error(`Insufficient stars. Required: ${this.TRAINING_COST} stars for training`);
        }
      }

      // Return mock result if in test mode
      if (isTest) {
        logger.info('Test mode: Returning mock training result');
        return this.getMockResult(params.trigger_word);
      }

      logger.info({
        params,
        totalActiveTrainings: this.activeTrainings.size,
        activeRequestIds: Array.from(this.activeTrainings.keys())
      }, 'Starting FAL training');

      const result = await fal.subscribe("fal-ai/flux-lora-fast-training", {
        input: {
          images_data_url: params.images_data_url,
          trigger_word: params.trigger_word,
          create_masks: params.create_masks,
          steps: params.steps,
          is_style: params.is_style,
        } as FalTrainingInput,
        logs: true,
        onQueueUpdate: (update: FalQueueStatusResponse) => {
          // Add detail logging
          logger.info({
            status: update.status,
            requestId: update.requestId,
            logsCount: update?.logs?.length,
            firstLog: update?.logs?.[0]?.message,
            lastLog: update?.logs?.[update.logs.length - 1]?.message
          }, 'Received FAL queue update');

          if (update.status === "IN_PROGRESS") {
            // Log before processing
            logger.info({
              requestId: update.requestId,
              currentProgress: this.getTrainingProgress(update.requestId)
            }, 'Before progress update');

            this.updateTrainingProgress(update.requestId, update);

            // Log after processing
            logger.info({
              requestId: update.requestId,
              currentProgress: this.getTrainingProgress(update.requestId)
            }, 'After progress update');
          }
        },
      }) as unknown as FalQueueResultResponse;

      if (!result.data?.diffusers_lora_file || !result.data?.config_file) {
        throw new Error('No data returned from training');
      }

      const trainingResult = {
        requestId: result.requestId,
        weights: this.convertFileToJson(result.data.diffusers_lora_file),
        config: this.convertFileToJson(result.data.config_file)
      };

      // After successful training, deduct stars and update training record
      if (!isTest) {
        await StarsService.updateStars(params.telegramId, {
          amount: -this.TRAINING_COST,
          type: 'TRAINING',
          metadata: {
            trigger_word: params.trigger_word,
            steps: params.steps,
            is_style: params.is_style
          }
        });

        // Find training by falRequestId
        const training = await prisma.training.findFirst({
          where: { falRequestId: result.requestId }
        });

        if (training) {
          // Update training record with stars spent and completed status
          await prisma.training.update({
            where: { databaseId: training.databaseId },
            data: {
              starsSpent: this.TRAINING_COST,
              status: TrainStatus.COMPLETED,
              completedAt: new Date()
            }
          });

          logger.info({
            trainingId: training.databaseId,
            requestId: result.requestId,
            starsSpent: this.TRAINING_COST
          }, 'Updated training record with stars spent');
        } else {
          logger.warn({ 
            requestId: result.requestId 
          }, 'Could not find training record to update stars spent');
        }
      }

      logger.info({ 
        weightsUrl: trainingResult.weights.url,
        configUrl: trainingResult.config.url,
        requestId: result.requestId,
        starsSpent: isTest ? 0 : this.TRAINING_COST,
        totalActiveTrainings: this.activeTrainings.size,
        activeRequestIds: Array.from(this.activeTrainings.keys())
      }, 'Training completed');

      return trainingResult;
    } catch (error) {
      logger.error({ error }, 'Model training failed');
      throw error;
    }
  }
}

// Create and export a single instance
export const trainingService = new TrainingService();