import { fal } from '@fal-ai/client';
import { config } from '../config.js';
import { logger } from './logger.js';

// Configure fal client with API key
fal.config({
  credentials: config.FAL_API_KEY
});

export interface TrainingOptions {
  steps: number;
  isStyle: boolean;
  createMasks: boolean;
  triggerWord: string;
  imagesDataUrl: string;
}

export interface TrainingProgress {
  status: 'pending' | 'training' | 'completed' | 'failed';
  progress: number;
  message?: string;
}

export interface TrainingResult {
  requestId: string;
  loraUrl: string;
  configUrl: string;
}

interface FalQueueSubmitResponse {
  requestId: string;
}

interface FalQueueStatusResponse {
  status: string;
  logs?: Array<{ message: string }>;
}

interface FalQueueResultResponse {
  data: {
    diffusers_lora_file: { url: string };
    config_file: { url: string };
  };
}

const activeTrainings = new Map<string, TrainingProgress>();

export async function startTraining(options: TrainingOptions): Promise<string> {
  try {
    // Start training with fal-ai
    const response = await fal.subscribe('fal-ai/flux-lora-fast-training', {
      input: {
        steps: options.steps,
        is_style: options.isStyle,
        create_masks: options.createMasks,
        trigger_word: options.triggerWord,
        images_data_url: options.imagesDataUrl
      }
    }) as FalQueueSubmitResponse;

    const requestId = response.requestId;

    // Initialize training progress
    activeTrainings.set(requestId, {
      status: 'pending',
      progress: 0
    });

    // Start monitoring progress
    void monitorTrainingProgress(requestId);

    return requestId;
  } catch (error) {
    logger.error({ error }, 'Failed to start training');
    throw error;
  }
}

export function getTrainingProgress(requestId: string): TrainingProgress | null {
  return activeTrainings.get(requestId) || null;
}

async function monitorTrainingProgress(requestId: string) {
  try {
    while (true) {
      // Get current status
      const response = await fal.subscribe('fal-ai/flux-lora-fast-training', {
        requestId: requestId,
        pollInterval: 1000,
        onQueueUpdate: (update: FalQueueStatusResponse) => {
          if (!update.logs) return;

          // Update progress based on logs
          let progress = 0;
          let message = '';

          const progressLog = update.logs
            .map((log) => log.message)
            .find((msg) => msg?.includes('progress'));

          if (progressLog) {
            const match = progressLog.match(/(\d+)%/);
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
            activeTrainings.set(requestId, {
              status: 'completed',
              progress: 100,
              message: 'Training completed successfully'
            });

            // Clean up after delay
            setTimeout(() => {
              activeTrainings.delete(requestId);
            }, 60 * 1000); // Remove after 1 minute
          } else if (update.status === 'FAILED') {
            currentStatus = 'failed';
            activeTrainings.set(requestId, {
              status: 'failed',
              progress,
              message: 'Training failed'
            });
          } else {
            // Update training status
            activeTrainings.set(requestId, {
              status: currentStatus,
              progress,
              message
            });
          }
        }
      });

      // If we get here, the subscription has ended
      break;
    }
  } catch (error) {
    logger.error({ error, requestId }, 'Error monitoring training progress');
    activeTrainings.set(requestId, {
      status: 'failed',
      progress: 0,
      message: 'Failed to monitor training progress'
    });
  }
}