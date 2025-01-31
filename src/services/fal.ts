import { logger } from '../logger';
import { FalError } from '../errors';

interface FalQueueResponse {
  status: string;
  request_id: string;
  response_url: string;
  status_url: string;
  cancel_url: string;
  logs: any[];
  metrics: {
    inference_time?: number;
  };
}

interface FalImage {
  url: string;
  width?: number;
  height?: number;
  content_type?: string;
}

interface FalGenerationResponse {
  seed?: number;
  images: FalImage[];
  prompt?: string;
  timings?: {
    inference?: number;
  };
  has_nsfw_concepts?: boolean[];
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

export class FalService {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://queue.fal.run/fal-ai/flux-lora';
  }

  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private validateResponse(response: any): response is FalGenerationResponse {
    try {
      logger.info({ raw_response: JSON.stringify(response, null, 2) }, 'Raw FAL response');

      if (!response || typeof response !== 'object') {
        logger.warn('Invalid response format - not an object');
        return false;
      }

      // Check for images array
      if (!Array.isArray(response.images)) {
        logger.warn('Response missing images array');
        return false;
      }

      if (response.images.length === 0) {
        logger.warn('Response images array is empty');
        return false;
      }

      const firstImage = response.images[0];
      if (!firstImage || typeof firstImage !== 'object' || !firstImage.url) {
        logger.warn('First image missing or invalid');
        return false;
      }

      logger.info({ 
        first_image: firstImage,
        seed: response.seed,
        has_nsfw: response.has_nsfw_concepts 
      }, 'Valid response found');
      
      return true;
    } catch (error) {
      logger.error({ error }, 'Error validating response');
      return false;
    }
  }

  private getImageUrlFromResponse(response: FalGenerationResponse): string {
    const firstImage = response.images[0];
    return firstImage.url;
  }

  public async generateImage(prompt: string, negativePrompt?: string): Promise<string> {
    let retries = 0;
    
    while (retries < MAX_RETRIES) {
      try {
        logger.info({ prompt, negativePrompt }, 'Starting image generation');
        
        // Initial request to queue
        const queueResponse = await fetch(`${this.baseUrl}/requests`, {
          method: 'POST',
          headers: {
            'Authorization': `Key ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: {
              prompt,
              negative_prompt: negativePrompt,
              image_size: "512x512",
              num_inference_steps: 28,
              guidance_scale: 3.5,
              seed: Math.floor(Math.random() * 1000000),
              num_images: 1
            }
          }),
        });

        if (!queueResponse.ok) {
          const error = await queueResponse.text();
          throw new FalError(`Queue request failed: ${error}`);
        }

        const queueData = await queueResponse.json() as FalQueueResponse;
        logger.info({ queue: queueData }, 'Queue initialized');

        // Poll for completion
        let attempts = 0;
        while (attempts < 30) { // 30 attempts * 2 seconds = 1 minute timeout
          const statusResponse = await fetch(queueData.status_url, {
            headers: {
              'Authorization': `Key ${this.apiKey}`,
            },
          });

          if (!statusResponse.ok) {
            const error = await statusResponse.text();
            throw new FalError(`Status check failed: ${error}`);
          }

          const statusData = await statusResponse.json() as FalQueueResponse;
          logger.info({ status: statusData.status }, 'Queue status update');

          if (statusData.status === 'COMPLETED') {
            logger.info('Generation completed, fetching result');
            
            // Fetch the result
            const resultResponse = await fetch(queueData.response_url, {
              headers: {
                'Authorization': `Key ${this.apiKey}`,
              },
            });

            if (!resultResponse.ok) {
              const error = await resultResponse.text();
              logger.error({ error }, 'Result fetch failed');
              throw new FalError(`Result fetch failed: ${error}`);
            }

            const result = await resultResponse.json();
            logger.info('Result received, validating');
            
            if (!this.validateResponse(result)) {
              logger.error({ result }, 'Invalid response format');
              throw new FalError('Invalid response format from FAL API');
            }

            const imageUrl = this.getImageUrlFromResponse(result);
            logger.info({ imageUrl }, 'Successfully extracted image URL');
            return imageUrl;
          }

          if (statusData.status === 'FAILED') {
            throw new FalError('Generation failed: ' + (statusData.logs?.join(', ') || 'Unknown error'));
          }

          await this.wait(2000);
          attempts++;
        }

        throw new FalError('Generation timed out');
      } catch (error) {
        if (retries === MAX_RETRIES - 1) {
          logger.error({ error }, 'Generation failed after all retries');
          throw error;
        }
        
        logger.warn({ error, retry: retries + 1 }, 'Generation failed, retrying...');
        retries++;
        await this.wait(RETRY_DELAY);
      }
    }

    throw new FalError('Generation failed after max retries');
  }
}