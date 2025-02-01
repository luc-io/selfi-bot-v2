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

export class FalService {
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
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
}