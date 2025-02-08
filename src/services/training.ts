import { fal } from "@fal-ai/client";
import { logger } from '../lib/logger.js';
import { StarsService } from './stars.js';
import { prisma } from '../lib/prisma.js';

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

if (!process.env.FAL_KEY) {
  throw new Error('FAL_KEY environment variable is not set');
}

// Now TypeScript knows FAL_KEY is not undefined
const credentials = process.env.FAL_KEY;

export class TrainingService {
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
    return this.activeTrainings.get(requestId) || null;
  }

  private updateTrainingProgress(requestId: string, update: FalQueueStatusResponse) {
    if (!update.logs || update.logs.length === 0) {
      logger.debug({ requestId }, 'No logs in update');
      return;
    }

    // Update progress based on logs
    let progress = 0;
    let message = 'Processing...';

    try {
      // Find progress message
      const progressLog = update.logs
        .map((log) => log.message)
        .find((msg) => msg?.includes('progress'));

      if (progressLog) {
        const match = progressLog.match(/(\\d+)%/);
        if (match) {
          progress = parseInt(match[1]);
        }
      }

      // Get last valid message
      const lastValidMessage = update.logs
        .filter(log => log && log.message)
        .slice(-1)[0];

      if (lastValidMessage) {
        message = lastValidMessage.message;
      }

      // Update status
      let currentStatus: TrainingProgress['status'] = 'training';
      
      if (update.status === 'COMPLETED') {
        currentStatus = 'completed';
        progress = 100;
        message = 'Training completed successfully';

        this.activeTrainings.set(requestId, {
          status: currentStatus,
          progress,
          message
        });

        // Clean up after delay
        setTimeout(() => {
          this.activeTrainings.delete(requestId);
        }, 60 * 1000); // Remove after 1 minute
      } else if (update.status === 'FAILED') {
        currentStatus = 'failed';
        message = 'Training failed';

        this.activeTrainings.set(requestId, {
          status: currentStatus,
          progress,
          message
        });
      } else {
        // Update training status
        this.activeTrainings.set(requestId, {
          status: currentStatus,
          progress,
          message
        });
      }

      logger.debug({ 
        requestId, 
        status: currentStatus, 
        progress, 
        message 
      }, 'Updated training progress');
    } catch (error) {
      logger.error({ 
        error, 
        requestId,
        updateData: update 
      }, 'Error processing training update');
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
          if (update.status === "IN_PROGRESS") {
            // Update progress tracking using the update's requestId
            this.updateTrainingProgress(update.requestId, update);

            // Log progress messages if available
            if (update.logs && update.logs.length > 0) {
              update.logs
                .filter(log => log && log.message)
                .forEach(log => logger.info({ 
                  msg: log.message, 
                  requestId: update.requestId 
                }, 'Training progress'));
            }
          }
        },
      }) as unknown as FalQueueResultResponse;

      if (!result.data?.diffusers_lora_file || !result.data?.config_file) {
        throw new Error('No data returned from training');
      }

      const trainingResult = {
        weights: this.convertFileToJson(result.data.diffusers_lora_file),
        config: this.convertFileToJson(result.data.config_file)
      };

      // After successful training, deduct stars
      await StarsService.updateStars(params.telegramId, {
        amount: -this.TRAINING_COST,
        type: 'TRAINING',
        metadata: {
          trigger_word: params.trigger_word,
          steps: params.steps,
          is_style: params.is_style
        }
      });

      // Update training record with stars spent
      await prisma.training.update({
        where: {
          id: result.requestId
        },
        data: {
          starsSpent: this.TRAINING_COST
        }
      });

      logger.info({ 
        weightsUrl: trainingResult.weights.url,
        configUrl: trainingResult.config.url,
        requestId: result.requestId,
        starsSpent: this.TRAINING_COST
      }, 'Training completed');

      return trainingResult;
    } catch (error) {
      logger.error({ error }, 'Model training failed');
      throw error;
    }
  }
}