import { fal } from "@fal-ai/client";
import { logger } from '../logger';

interface FalGenerationResponse {
  seed: number;
  images: Array<{
    url: string;
    width: number;
    height: number;
    content_type: string;
  }>;
  prompt: string;
  timings: {
    inference: number;
  };
  has_nsfw_concepts: boolean[];
}

interface FalTrainingResponse {
  diffusers_lora_file: {
    url: string;
    file_name: string;
    file_size: number;
    content_type: string;
  };
  config_file: {
    url: string;
    file_name: string;
    file_size: number;
    content_type: string;
  };
  debug_preprocessed_output?: {
    url: string;
    file_name: string;
    file_size: number;
    content_type: string;
  } | null;
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

  public async trainModel(params: {
    images_data_url: string;
    trigger_word: string;
    steps: number;
    is_style: boolean;
    create_masks: boolean;
  }): Promise<FalTrainingResponse> {
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
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            update.logs.map((log) => log.message).forEach(msg => logger.info({ msg }, 'Training progress'));
          }
        },
      });

      if (!result.data) {
        throw new Error('No data returned from training');
      }

      logger.info({ 
        weightsUrl: result.data.diffusers_lora_file.url,
        configUrl: result.data.config_file.url 
      }, 'Training completed');

      return result.data;
    } catch (error) {
      logger.error({ error }, 'Model training failed');
      throw error;
    }
  }
}