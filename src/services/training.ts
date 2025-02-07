import { fal } from "@fal-ai/client";
import { logger } from '../lib/logger.js';

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
        const match = progressLog.match(/(\d+)%/);
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

  public async trainModel(params: TrainModelParams): Promise<TrainingResult> {
    try {
      logger.info({ params }, 'Starting model training');

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

      logger.info({ 
        weightsUrl: trainingResult.weights.url,
        configUrl: trainingResult.config.url,
        requestId: result.requestId
      }, 'Training completed');

      return trainingResult;
    } catch (error) {
      logger.error({ error }, 'Model training failed');
      throw error;
    }
  }
}