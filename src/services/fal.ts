import { fal } from "@fal-ai/client";
import { logger } from '../logger.js';

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
  content_type: string;
  file_name: string;
  file_size: number;
}

interface FalTrainingJsonResult {
  url: string;
  fileName: string;
  fileSize: number;
  contentType: string;
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

interface FalTrainingResult {
  data: FalTrainingResponse;
  requestId: string;
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
      const result = await fal.subscribe("fal-ai/flux-lora", {
        input: {
          prompt,
          negative_prompt: negativePrompt,
          image_size: 'landscape_4_3',
          guidance_scale: 3.5,
          num_inference_steps: 28,
          num_images: 1
        },
        logs: true,
      }) as { data: FalGenerationResponse };

      return result.data.images[0].url;
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
          trigger_word: params.trigger_word,
          create_masks: params.create_masks,
          steps: params.steps,
          is_style: params.is_style,
        } as FalTrainingInput,
        logs: true,
        onQueueUpdate: (update: QueueUpdate) => {
          if (update.status === "IN_PROGRESS") {
            update.logs.map((log) => log.message).forEach((msg: string) => 
              logger.info({ msg }, 'Training progress')
            );
          }
        },
      }) as unknown as FalTrainingResult;

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