import { fal } from "@fal-ai/client";
import { logger } from '../logger';

interface FalImage {
  url: string;
  width: number;
  height: number;
  content_type: string;
}

interface FalGenerationResponse {
  seed: number;
  images: Array<FalImage>;
  prompt: string;
  timings: {
    inference: number;
  };
  has_nsfw_concepts: boolean[];
}

interface FalFile {
  url: string;
  file_name: string;
  file_size: number;
  content_type: string;
}

interface FalTrainingJsonResult {
  url: string;
  fileName: string;
  fileSize: number;
  contentType: string;
}

interface QueueUpdate {
  status: string;
  logs: Array<{ message: string }>;
}

export class FalService {
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    // Configure FAL client
    fal.config({
      credentials: `${this.apiKey}:${this.apiSecret}`
    });
  }

  public async generateImage(prompt: string, negativePrompt?: string): Promise<string> {
    try {
      const result = await fetch('https://queue.fal.run/fal-ai/flux-lora/subscribe', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${this.apiKey}:${this.apiSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            prompt,
            negative_prompt: negativePrompt,
            image_size: 'landscape_4_3',
            guidance_scale: 3.5,
            num_inference_steps: 28,
            num_images: 1
          }
        }),
      });

      if (!result.ok) {
        throw new Error(`Generation failed with status ${result.status}`);
      }

      const response = await result.json() as FalGenerationResponse;
      return response.images[0].url;
    } catch (error) {
      logger.error({ error }, 'Image generation failed');
      throw error;
    }
  }

  private convertFileToJson(file: FalFile): FalTrainingJsonResult {
    return {
      url: file.url,
      fileName: file.file_name,
      fileSize: file.file_size,
      contentType: file.content_type
    };
  }

  public async trainModel(params: {
    images_data_url: string;
    trigger_word: string;
    steps: number;
    is_style: boolean;
    create_masks: boolean;
  }): Promise<{ weights: FalTrainingJsonResult; config: FalTrainingJsonResult }> {
    try {
      logger.info({ params }, 'Starting model training');
      
      const result = await fal.subscribe("fal-ai/flux-lora-fast-training", {
        input: {
          images_data_url: params.images_data_url,
          create_masks: params.create_masks,
          steps: params.steps,
          is_style: params.is_style,
          trigger_word: params.trigger_word,
        },
        logs: true,
        onQueueUpdate: (update: QueueUpdate) => {
          if (update.status === "IN_PROGRESS") {
            update.logs.map((log) => log.message).forEach((msg: string) => 
              logger.info({ msg }, 'Training progress')
            );
          }
        },
      });

      if (!result.data?.diffusers_lora_file || !result.data?.config_file) {
        throw new Error('No data returned from training');
      }

      const response = {
        weights: this.convertFileToJson(result.data.diffusers_lora_file),
        config: this.convertFileToJson(result.data.config_file)
      };

      logger.info({ 
        weightsUrl: response.weights.url,
        configUrl: response.config.url 
      }, 'Training completed');

      return response;
    } catch (error) {
      logger.error({ error }, 'Model training failed');
      throw error;
    }
  }
}