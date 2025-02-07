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

const falKey = process.env.FAL_KEY;
if (!falKey) {
  throw new Error('FAL_KEY environment variable is not set');
}

export class TrainingService {
  private readonly activeTrainings = new Map<string, TrainingProgress>();

  constructor() {
    fal.config({
      credentials: falKey
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
    if (!update.logs) return;

    // Update progress based on logs
    let progress = 0;
    let message = '';

    const progressLog = update.logs
      .map((log) => log.message)
      .find((msg) => msg?.includes('progress'));

    if (progressLog) {
      const match = progressLog.match(/(\\d+)%/);
      if (match) {
        progress = parseInt(match[1]);
      }
    }

    // Get last message
    message = update.logs[update.logs.length - 1].message;

    // Update status
    let currentStatus: TrainingProgress['status'] = 'training';
    if (update.status === 'COMPLETED') {
      currentStatus = 'completed';
      this.activeTrainings.set(requestId, {
        status: 'completed',
        progress: 100,
        message: 'Training completed successfully'
      });

      // Clean up after delay
      setTimeout(() => {
        this.activeTrainings.delete(requestId);
      }, 60 * 1000); // Remove after 1 minute
    } else if (update.status === 'FAILED') {
      currentStatus = 'failed';
      this.activeTrainings.set(requestId, {
        status: 'failed',
        progress,
        message: 'Training failed'
      });
    } else {
      // Update training status
      this.activeTrainings.set(requestId, {
        status: currentStatus,
        progress,
        message
      });
    }
  }

  public async trainModel(params: TrainModelParams): Promise<TrainingResult> {
    try {
      logger.info({ params }, 'Starting model training');

      // Initialize training progress
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
            // Update progress tracking
            this.updateTrainingProgress(result.requestId, update);

            // Log progress messages
            update.logs?.map((log) => log.message).forEach((msg: string) => 
              logger.info({ msg }, 'Training progress')
            );
          }
        },
      });

      const response = result.data as FalTrainingResponse;

      if (!response?.diffusers_lora_file || !response?.config_file) {
        throw new Error('No data returned from training');
      }

      const trainingResult = {
        weights: this.convertFileToJson(response.diffusers_lora_file),
        config: this.convertFileToJson(response.config_file)
      };

      logger.info({ 
        weightsUrl: trainingResult.weights.url,
        configUrl: trainingResult.config.url 
      }, 'Training completed');

      return trainingResult;
    } catch (error) {
      logger.error({ error }, 'Model training failed');
      throw error;
    }
  }
}