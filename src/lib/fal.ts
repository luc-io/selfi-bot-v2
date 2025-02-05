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

const activeTrainings = new Map<string, TrainingProgress>();

export async function startTraining(options: TrainingOptions): Promise<string> {
  try {
    // Start training with fal-ai
    const { requestId } = await fal.queue.submit('fal-ai/flux-lora-fast-training', {
      input: {
        steps: options.steps,
        is_style: options.isStyle,
        create_masks: options.createMasks,
        trigger_word: options.triggerWord,
        images_data_url: options.imagesDataUrl
      }
    });

    // Initialize training progress
    activeTrainings.set(requestId, {
      status: 'pending',
      progress: 0
    });

    // Start monitoring progress
    monitorTrainingProgress(requestId);

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
      const status = await fal.queue.status('fal-ai/flux-lora-fast-training', {
        requestId,
        logs: true
      });

      // Update progress based on logs
      const progressLog = status.logs
        ?.map((log) => log.message)
        .find(msg => msg?.includes('progress'));

      let progress = 0;
      if (progressLog) {
        const match = progressLog.match(/(\d+)%/);
        if (match) {
          progress = parseInt(match[1]);
        }
      }

      // Update status
      let currentStatus: TrainingProgress['status'] = 'training';
      if (status.status === 'COMPLETED') {
        currentStatus = 'completed';
        
        // Get result and store URLs
        const result = await fal.queue.result('fal-ai/flux-lora-fast-training', {
          requestId
        });

        activeTrainings.set(requestId, {
          status: 'completed',
          progress: 100,
          message: 'Training completed successfully'
        });

        // Clean up after delay
        setTimeout(() => {
          activeTrainings.delete(requestId);
        }, 60 * 1000); // Remove after 1 minute

        break;
      } else if (status.status === 'FAILED') {
        currentStatus = 'failed';
        activeTrainings.set(requestId, {
          status: 'failed',
          progress,
          message: 'Training failed'
        });
        break;
      }

      // Update training status
      activeTrainings.set(requestId, {
        status: currentStatus,
        progress,
        message: status.logs?.[status.logs.length - 1]?.message
      });

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 1000));
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